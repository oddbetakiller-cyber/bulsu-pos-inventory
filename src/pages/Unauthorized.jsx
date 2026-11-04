
import { useNavigate } from "react-router-dom";

function Unauthorized() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
      <div className="bg-white p-8 rounded-xl shadow-lg text-center max-w-md w-full">
        <h1 className="text-3xl font-bold text-red-600 mb-3">
          Access Denied
        </h1>

        <p className="text-gray-600 mb-6">
          You are not authorized to access this page.
          Please log in first.
        </p>

        <button
          onClick={() => navigate("/", { replace: true })}
          className="bg-[#8B1E2D] text-white px-6 py-2 rounded-lg font-bold"
        >
          Back to Login
        </button>
      </div>
    </div>
  );
}

export default Unauthorized;
