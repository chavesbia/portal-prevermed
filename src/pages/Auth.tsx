import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Lock, User, AlertCircle, Mail } from 'lucide-react';
import logoPrevermed from '@/assets/logo-prevermed.png';
import { z } from 'zod';

// Validation schema
const loginSchema = z.object({
  login: z.string().trim().min(1, 'Login é obrigatório').max(100, 'Login muito longo'),
  password: z.string().min(1, 'Senha é obrigatória').max(72, 'Senha muito longa'),
});

const recoverySchema = z.object({
  login: z.string().trim().min(1, 'Informe seu login para recuperar a senha').max(100, 'Login muito longo'),
});

export default function Auth() {
  const navigate = useNavigate();
  const { signIn, user } = useAuth();
  
  const [isLoading, setIsLoading] = useState(false);
  const [isRecoveryLoading, setIsRecoveryLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  
  // Login form state
  const [loginField, setLoginField] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Redirect if already logged in
  useEffect(() => {
    if (user) {
      checkMustChangePassword();
    }
  }, [user]);

  const checkMustChangePassword = async () => {
    if (!user) return;
    
    const { data: profile } = await supabase
      .from('profiles')
      .select('must_change_password')
      .eq('user_id', user.id)
      .maybeSingle();
      
    if (profile?.must_change_password) {
      navigate('/alterar-senha');
    } else {
      navigate('/');
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    
    // Validate input
    const validation = loginSchema.safeParse({
      login: loginField,
      password: loginPassword,
    });
    
    if (!validation.success) {
      setError(validation.error.errors[0].message);
      return;
    }
    
    setIsLoading(true);
    
    try {
      // First, find the auth email from the login field
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('email, must_change_password')
        .eq('login', loginField.trim().toLowerCase())
        .maybeSingle();
      
      if (profileError || !profile) {
        setError('Usuário não encontrado');
        setIsLoading(false);
        return;
      }
      
      // Now sign in with the actual email
      const { error } = await signIn(profile.email, loginPassword);
      
      if (error) {
        if (error.message.includes('Invalid login credentials')) {
          setError('Login ou senha incorretos');
        } else if (error.message.includes('Email not confirmed')) {
          setError('Por favor, confirme seu e-mail antes de entrar');
        } else {
          setError('Erro ao fazer login. Tente novamente.');
        }
      } else {
        // Check if must change password
        if (profile.must_change_password) {
          navigate('/alterar-senha');
        } else {
          navigate('/');
        }
      }
    } catch (err) {
      setError('Erro inesperado. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasswordRecovery = async () => {
    setError(null);
    setInfo(null);

    const validation = recoverySchema.safeParse({ login: loginField });
    if (!validation.success) {
      setError(validation.error.errors[0].message);
      return;
    }

    setIsRecoveryLoading(true);

    try {
      const login = loginField.trim().toLowerCase();

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('email')
        .eq('login', login)
        .maybeSingle();

      if (profileError || !profile?.email) {
        setError('Usuário não encontrado');
        return;
      }

      const { error: recoveryError } = await supabase.auth.resetPasswordForEmail(profile.email, {
        redirectTo: `${window.location.origin}/alterar-senha`,
      });

      if (recoveryError) {
        setError('Não foi possível enviar o link de recuperação. Tente novamente.');
        return;
      }

      setInfo('Enviamos um link para redefinição de senha para o e-mail cadastrado.');
    } catch {
      setError('Erro inesperado. Tente novamente.');
    } finally {
      setIsRecoveryLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/10 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <img 
              src={logoPrevermed} 
              alt="PreverMed" 
              className="h-16 w-auto"
            />
          </div>
        </div>

        {/* Auth Card */}
        <Card className="border-0 shadow-xl">
          <CardHeader className="text-center pb-4">
            <CardTitle className="text-2xl font-bold text-primary">Portal PreverMed</CardTitle>
            <CardDescription className="text-muted-foreground">
              Entre com suas credenciais para acessar
            </CardDescription>
          </CardHeader>

          <form onSubmit={handleLogin}>
            <CardContent className="space-y-4">
              {/* Error message */}
              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {info && (
                <Alert>
                  <Mail className="h-4 w-4" />
                  <AlertDescription>{info}</AlertDescription>
                </Alert>
              )}
              
              <div className="space-y-2">
                <Label htmlFor="login">Login</Label>
                <div className="relative">
                  <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="login"
                    type="text"
                    placeholder="seu.login"
                    value={loginField}
                    onChange={(e) => setLoginField(e.target.value)}
                    className="pl-10"
                    required
                    disabled={isLoading || isRecoveryLoading}
                    autoComplete="username"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Ex: nome.sobrenome
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="login-password">Senha</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="login-password"
                    type="password"
                    placeholder="••••••••"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    className="pl-10"
                    required
                    disabled={isLoading || isRecoveryLoading}
                    autoComplete="current-password"
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <Button
                  type="button"
                  variant="link"
                  className="h-auto p-0 text-sm"
                  onClick={handlePasswordRecovery}
                  disabled={isLoading || isRecoveryLoading}
                >
                  {isRecoveryLoading ? (
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Enviando link...
                    </span>
                  ) : (
                    'Primeiro acesso / Esqueci minha senha'
                  )}
                </Button>
              </div>
            </CardContent>
            <CardFooter>
              <Button 
                type="submit" 
                className="w-full" 
                disabled={isLoading || isRecoveryLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Entrando...
                  </>
                ) : (
                  'Entrar'
                )}
              </Button>
            </CardFooter>
          </form>
        </Card>

        {/* Footer */}
        <p className="text-center text-sm text-muted-foreground mt-6">
          © {new Date().getFullYear()} PreverMed. Todos os direitos reservados.
        </p>
      </div>
    </div>
  );
}
