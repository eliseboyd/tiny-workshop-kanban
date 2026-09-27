import { login } from './actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import styles from './page.module.css';

export default async function LoginPage(props: {
  searchParams: Promise<{ message: string }>;
}) {
  const searchParams = await props.searchParams;
  return (
    <div className={styles.Root}>
      <Card className={styles.Card}>
        <CardHeader>
          <CardTitle className={styles.Title}>Login</CardTitle>
          <CardDescription>
            Enter your email below to login to your account.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className={styles.Form}>
            <div className={styles.Field}>
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" placeholder="m@example.com" required />
            </div>
            <div className={styles.Field}>
              <Label htmlFor="password">Password</Label>
              <Input id="password" name="password" type="password" required />
            </div>
            
            {searchParams?.message && (
                <p className={styles.Error}>{searchParams.message}</p>
            )}

            <div className={styles.Actions}>
                <Button formAction={login} className={styles.Submit}>Log in</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

