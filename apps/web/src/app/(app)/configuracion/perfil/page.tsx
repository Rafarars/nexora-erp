import { ProfileForms } from '@/sections/access/profile-forms';
import { requireSession } from '@/shared/session/current-session';

export const dynamic = 'force-dynamic';

export default async function ProfilePage() {
  const { session } = await requireSession();

  return <ProfileForms name={session.name} email={session.email} />;
}
