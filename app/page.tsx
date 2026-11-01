import DashboardHome from '@/components/dashboard/DashboardHome';
import DashboardViewportShell from '@/components/dashboard/DashboardViewportShell';

export default function HomePage() {
	return (
		<DashboardViewportShell>
			<DashboardHome />
		</DashboardViewportShell>
	);
}
