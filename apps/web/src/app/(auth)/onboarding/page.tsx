import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function OnboardingPage() {
  return (
    <main className="mx-auto w-full max-w-4xl space-y-4 p-6">
      <h1 className="text-2xl font-semibold">Onboarding</h1>
      <p className="text-sm text-muted-foreground">
        This skeleton is ready for invite acceptance, tenant setup wizard and first-run automation configuration.
      </p>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Step 1</CardTitle>
            <CardDescription>Accept invite and verify email</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Hook this card to the invite token and email verification flows from the backend auth module.
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Step 2</CardTitle>
            <CardDescription>Configure tenant baseline</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Add company profile, timezone, default SLA policy and alert routing rules.
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
