import { Link } from 'react-router-dom';
import { Home } from 'lucide-react';

function NotFound() {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#f9fafb',
      padding: '20px',
      textAlign: 'center'
    }}>
      <div style={{ maxWidth: '450px' }}>

        <h1 style={{
          fontSize: '100px',
          fontWeight: '800',
          color: '#8B1E2D',
          margin: 0
        }}>
          404
        </h1>

        <h2 style={{
          fontSize: '26px',
          fontWeight: '700',
          color: '#1f2937',
          marginBottom: '12px'
        }}>
          Page Not Found
        </h2>

        <p style={{
          color: '#6b7280',
          marginBottom: '28px'
        }}>
          Sorry! The page you are looking for
          doesn't exist or may have been moved.
        </p>

        <Link to="/" style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          background: '#8B1E2D',
          color: 'white',
          padding: '12px 24px',
          borderRadius: '10px',
          textDecoration: 'none',
          fontWeight: '600'
        }}>
          <Home size={18} />
          Back to Home
        </Link>

      </div>
    </div>
  );
}

export default NotFound;
