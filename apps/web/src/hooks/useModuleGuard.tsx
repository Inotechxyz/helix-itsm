import { useState, useEffect } from 'react';
import { AxiosError } from 'axios';
import { AlertTriangle, ShieldOff } from 'lucide-react';
import { Card, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Link } from 'react-router-dom';

interface UseModuleErrorResult {
  error: Error | null;
  isModuleDisabled: boolean;
  moduleName: string;
}

export function useModuleError(error: Error | null): UseModuleErrorResult {
  const [isModuleDisabled, setIsModuleDisabled] = useState(false);
  const [moduleName, setModuleName] = useState('');

  useEffect(() => {
    if (error) {
      const axiosError = error as AxiosError<{ message?: string; statusCode?: number }>;

      // Check if it's a 403 Forbidden error related to module being disabled
      if (axiosError.response?.status === 403) {
        const message = axiosError.response?.data?.message || '';
        if (message.includes('module is currently disabled')) {
          setIsModuleDisabled(true);
          // Extract module name from message like "The 'Tickets' module is currently disabled"
          const match = message.match(/The '([^']+)' module/);
          if (match) {
            setModuleName(match[1]);
          }
        }
      }
    } else {
      setIsModuleDisabled(false);
      setModuleName('');
    }
  }, [error]);

  return { error, isModuleDisabled, moduleName };
}

interface ModuleDisabledMessageProps {
  moduleName: string;
  className?: string;
}

export function ModuleDisabledMessage({ moduleName, className = '' }: ModuleDisabledMessageProps) {
  return (
    <Card className={className}>
      <CardContent className="p-8 text-center">
        <div className="flex justify-center mb-4">
          <div className="p-4 rounded-full bg-yellow-100 dark:bg-yellow-900/30">
            <ShieldOff className="w-12 h-12 text-yellow-600 dark:text-yellow-400" />
          </div>
        </div>
        <h2 className="text-xl font-semibold mb-2">Module Currently Unavailable</h2>
        <p className="text-muted-foreground mb-4">
          The <strong>{moduleName}</strong> module has been disabled by your administrator.
        </p>
        <p className="text-sm text-muted-foreground mb-6">
          Please contact your system administrator if you believe this is an error.
        </p>
        <Link to="/dashboard">
          <Button variant="outline">
            Return to Dashboard
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}

interface ModuleErrorHandlerProps {
  error: Error | null;
  moduleName: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function ModuleErrorHandler({ error, moduleName, children, fallback }: ModuleErrorHandlerProps) {
  const { isModuleDisabled, moduleName: disabledModuleName } = useModuleError(error);

  if (isModuleDisabled) {
    if (fallback) {
      return <>{fallback}</>;
    }
    return (
      <ModuleDisabledMessage
        moduleName={disabledModuleName || moduleName}
      />
    );
  }

  return <>{children}</>;
}
