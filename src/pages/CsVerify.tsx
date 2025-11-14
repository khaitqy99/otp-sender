import { CsVerifyOtp } from "@/components/CsVerifyOtp";
import { Navigation } from "@/components/Navigation";

const CsVerify = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/30">
      <Navigation />
      <div className="container mx-auto px-4 py-12 max-w-4xl">
        {/* Main Content */}
        <div>
          <CsVerifyOtp />
        </div>
      </div>
    </div>
  );
};

export default CsVerify;

