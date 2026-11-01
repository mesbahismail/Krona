'use client';

import * as React from 'react';
import * as AccordionPrimitive from '@radix-ui/react-accordion';
import { Minus, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DAILY_CHALLENGES_NAME } from '@/lib/challenges';

const FAQS = [
	{
		question: 'How do I start a focus session?',
		answer:
			'On Home, use the timer in the top bar. Choose Work or a break mode, then press Start. Sessions run in the background while you move around the app, and time is tracked automatically. To attach focus time to a task, select that task on the dashboard or use the timer icon on a task in Projects.',
	},
	{
		question: 'How do I organize projects and tasks?',
		answer:
			'Open Projects from the page menu or navigation. Create a project, then add tasks inside it. You can mark tasks done, star important ones, set deadlines, and delete with a short undo window. From Projects, the timer icon on a task selects it for your current focus session so tracked time goes to that work.',
	},
	{
		question: 'What is included in Krona Pro?',
		answer: `Free access covers Home, the focus timer, Projects & tasks, and Settings. Krona Pro unlocks Reminders, ${DAILY_CHALLENGES_NAME}, Performance insights, and Krona AI. Open Subscribe from your account menu when you are ready to upgrade, or use Help Request below if you have a billing question.`,
	},
	{
		question: 'How do I create and manage reminders?',
		answer:
			'Reminders are a Krona Pro feature. Open Reminders from the page menu or click the date chip in the top bar, then add a reminder with a title and time. Krona will surface it when it’s due. You can also turn on deadline reminders when you set a due date on a task or project. Sound and alert preferences live under Settings → Notifications.',
	},
	{
		question: 'How do I update my profile or password?',
		answer:
			'Click your avatar in the top right to open Account for name, email, and profile details. To change your password, go to Settings → Account → Change password. Prefer a quieter workspace? Use Settings for theme, notification sounds, and other preferences.',
	},
] as const;

function FaqTrigger({
	className,
	children,
	...props
}: React.ComponentProps<typeof AccordionPrimitive.Trigger>) {
	return (
		<AccordionPrimitive.Header className="flex">
			<AccordionPrimitive.Trigger
				className={cn(
					'group flex flex-1 items-center justify-between gap-3 rounded-md py-3 text-left text-[15px] font-medium text-[var(--krona-text)] outline-none transition-colors hover:text-[var(--krona-text)] focus-visible:ring-2 focus-visible:ring-white/25',
					className,
				)}
				{...props}
			>
				<span className="min-w-0 flex-1">{children}</span>
				<span
					className="inline-flex size-7 shrink-0 items-center justify-center rounded-md text-[var(--krona-text-muted)]"
					aria-hidden
				>
					<Plus
						size={18}
						strokeWidth={2.25}
						className="group-data-[state=open]:hidden"
					/>
					<Minus
						size={18}
						strokeWidth={2.25}
						className="hidden group-data-[state=open]:block"
					/>
				</span>
			</AccordionPrimitive.Trigger>
		</AccordionPrimitive.Header>
	);
}

export default function HelpFaqsPanel() {
	return (
		<section className="rounded-[24px] border border-[var(--krona-surface-border)] bg-[var(--krona-widget-bg)] p-5 shadow-[var(--krona-widget-shadow)] backdrop-blur-[var(--krona-widget-blur)] backdrop-saturate-150">
			<h2 className="text-xl font-semibold text-[var(--krona-text)]">FAQs</h2>
			<p className="mt-1 text-sm text-[var(--krona-text-muted)]">
				Quick answers to common questions.
			</p>
			<AccordionPrimitive.Root
				type="single"
				collapsible
				className="mt-4 w-full space-y-2"
			>
				{FAQS.map((item, index) => (
					<AccordionPrimitive.Item
						key={item.question}
						value={`faq-${index}`}
						className="relative isolate rounded-2xl border border-[var(--krona-surface-border)] bg-[var(--krona-widget-bg)] px-3 shadow-[var(--krona-widget-item-shadow)] transition-[border-color,box-shadow] duration-200 before:pointer-events-none before:absolute before:inset-0 before:z-0 before:rounded-[inherit] before:bg-transparent before:transition-colors before:duration-200 hover:border-[var(--krona-widget-border-hover)] hover:before:bg-[var(--krona-widget-list-item-hover)]"
					>
						<div className="relative z-[1]">
							<FaqTrigger>{item.question}</FaqTrigger>
							<AccordionPrimitive.Content className="overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
								<p className="pb-3 pr-8 text-sm leading-relaxed text-[var(--krona-text-muted)]">
									{item.answer}
								</p>
							</AccordionPrimitive.Content>
						</div>
					</AccordionPrimitive.Item>
				))}
			</AccordionPrimitive.Root>
		</section>
	);
}
