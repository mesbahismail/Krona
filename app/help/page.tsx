import Background from '@/components/Background';
import Top from '@/components/Top';
import HelpFaqsPanel from '@/components/help/HelpFaqsPanel';
import HelpRequestForm from '@/components/help/HelpRequestForm';

export default function HelpPage() {
	return (
		<div className="relative min-h-screen overflow-x-hidden">
			<Background />
			<div className="krona-main-content relative z-[1] min-w-0 overflow-x-hidden">
				<Top title="Help Center" />

				<div className="w-full min-w-0 pt-4 pb-8 text-center sm:pt-5 sm:pb-10">
					<h1 className="text-[34px] font-semibold leading-tight text-[var(--krona-text)]">
						Help Center
					</h1>
					<p className="mx-auto mt-2 max-w-xl text-[16px] text-[var(--krona-text-muted)]">
						FAQs and a support request form for anything you need help with.
					</p>
				</div>

				<div className="w-full min-w-0 pb-10 pt-2 text-[var(--krona-text)]">
					<div className="mx-auto flex min-w-0 max-w-3xl flex-col gap-7">
						<HelpFaqsPanel />

						<section className="min-w-0 rounded-[24px] border border-[var(--krona-surface-border)] bg-[var(--krona-widget-bg)] p-5 shadow-[var(--krona-widget-shadow)] backdrop-blur-[var(--krona-widget-blur)] backdrop-saturate-150">
							<h2 className="text-xl font-semibold">Send Help Request</h2>
							<p className="mt-1 text-sm text-[var(--krona-text-muted)]">
								Describe your issue and our team can review it.
							</p>
							<HelpRequestForm />
						</section>
					</div>
				</div>
			</div>
		</div>
	);
}
