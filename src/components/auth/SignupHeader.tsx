import { Link, useLocation } from "react-router-dom";

const SignupHeader = () => {
  const location = useLocation();
  return (
    <div className="space-y-2 text-center">
      <div className="mx-auto inline-flex rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground">
        Create your account
      </div>
      <h1 className="font-heading text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
        Create your account
      </h1>
      <p className="text-sm leading-6 text-muted-foreground sm:text-base">
        Already have an account?{" "}
        <Link to="/login" className="font-medium text-primary transition-colors hover:text-primary/80 underline-offset-4 hover:underline">
          Log in
        </Link>
      </p>
    </div>
  );
};

export default SignupHeader;
