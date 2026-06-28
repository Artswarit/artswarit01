import type { Meta, StoryObj } from '@storybook/react';
import { ChatFullscreenPreview, ChatEmptyStatePreview } from './ChatFullscreenPreview';

const meta: Meta<typeof ChatFullscreenPreview> = {
  title: 'Dashboard/Chat/Fullscreen',
  component: ChatFullscreenPreview,
  parameters: {
    layout: 'fullscreen',
    chromatic: {
      // Snapshot at the breakpoints we care about for regression.
      viewports: [360, 390, 414, 768, 820, 1024],
      delay: 200,
    },
  },
};

export default meta;
type Story = StoryObj<typeof ChatFullscreenPreview>;

export const DefaultMobile: Story = {
  name: 'Default (mobile)',
  args: { messageCount: 6 },
  parameters: { viewport: { defaultViewport: 'iphone13' } },
};

export const WithLoadMorePill: Story = {
  name: 'Load older messages — idle',
  args: { showLoadMore: true, messageCount: 12 },
  parameters: { viewport: { defaultViewport: 'iphone13' } },
};

export const LoadingOlderMessages: Story = {
  name: 'Load older messages — loading',
  args: { showLoadMore: true, loadingOlder: true, messageCount: 12 },
  parameters: { viewport: { defaultViewport: 'iphone13' } },
};

export const WithTypingIndicator: Story = {
  name: 'With typing indicator',
  args: { messageCount: 6, withTypingIndicator: true },
  parameters: { viewport: { defaultViewport: 'iphone13' } },
};

export const Tablet: Story = {
  name: 'Tablet (iPad Mini)',
  args: { showLoadMore: true, messageCount: 14 },
  parameters: { viewport: { defaultViewport: 'ipad' } },
};

export const TabletLandscape: Story = {
  name: 'Tablet landscape',
  args: { showLoadMore: true, messageCount: 14 },
  parameters: { viewport: { defaultViewport: 'ipad12p' } },
};

export const DenseThread: Story = {
  name: 'Dense thread (40 msgs)',
  args: { showLoadMore: true, messageCount: 40 },
  parameters: { viewport: { defaultViewport: 'iphone13' } },
};

export const EmptyState: StoryObj<typeof ChatEmptyStatePreview> = {
  render: () => <ChatEmptyStatePreview />,
  parameters: { viewport: { defaultViewport: 'iphone13' } },
};
