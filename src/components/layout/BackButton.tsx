import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate, useLocation } from 'react-router-dom';

export function BackButton() {
  const navigate = useNavigate();
  const location = useLocation();

  // Hide on root/home
  if (location.pathname === '/' || location.pathname === '') return null;

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate('/');
    }
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleBack}
      className="mb-3 -ml-2 text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft className="h-4 w-4 mr-1" />
      Voltar
    </Button>
  );
}
