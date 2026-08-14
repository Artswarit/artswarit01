-- ============================================================================
-- Make user blocking actually block
-- ============================================================================
-- BlockUserButton tells the user "they won't be able to message you", but
-- nothing enforced it: user_blocks was only ever written, never consulted.
-- Both parties could keep messaging each other after a block.
--
-- Enforced with a trigger rather than an RLS policy so it applies to every
-- writer (including service-role paths) and does not have to be merged with the
-- existing, partly untracked policies on `messages`.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.reject_message_between_blocked_users()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _other_id uuid;
BEGIN
  IF NEW.sender_id IS NULL OR NEW.conversation_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Resolve the counterparty from the conversation.
  SELECT CASE
           WHEN c.client_id = NEW.sender_id THEN c.artist_id
           ELSE c.client_id
         END
    INTO _other_id
    FROM public.conversations c
   WHERE c.id = NEW.conversation_id;

  IF _other_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- A block in EITHER direction stops the conversation: the blocker should not
  -- receive messages, and the blocked user should not be able to reach them.
  IF EXISTS (
    SELECT 1 FROM public.user_blocks b
     WHERE (b.blocker_id = NEW.sender_id AND b.blocked_id = _other_id)
        OR (b.blocker_id = _other_id AND b.blocked_id = NEW.sender_id)
  ) THEN
    RAISE EXCEPTION 'This conversation is unavailable because one participant has blocked the other'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS reject_blocked_messages_trigger ON public.messages;
CREATE TRIGGER reject_blocked_messages_trigger
  BEFORE INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.reject_message_between_blocked_users();

-- Supports the lookup above and the blocked-list reads in useBlockedUsers.
CREATE INDEX IF NOT EXISTS idx_user_blocks_blocker_id ON public.user_blocks (blocker_id);
CREATE INDEX IF NOT EXISTS idx_user_blocks_blocked_id ON public.user_blocks (blocked_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON public.messages (conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON public.messages (sender_id);
CREATE INDEX IF NOT EXISTS idx_conversations_client_id ON public.conversations (client_id);
CREATE INDEX IF NOT EXISTS idx_conversations_artist_id ON public.conversations (artist_id);
