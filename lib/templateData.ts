/** Fictional, editable content used to demonstrate the local template. */
export const TEMPLATE_USER_ID = '00000000-0000-4000-8000-000000000001';
export const TEMPLATE_ORG_ID = 'demo-studio';
export type TemplateRow = Record<string, unknown>;
export type TemplateDatabase = Record<string, TemplateRow[]>;

export function createTemplateData(now = new Date()): TemplateDatabase {
	const userId = TEMPLATE_USER_ID;
	const orgId = TEMPLATE_ORG_ID;
	const day = (offset = 0) => {
		const date = new Date(now);
		date.setDate(date.getDate() + offset);
		return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
	};
	const at = (offset: number, hour = 10) =>
		new Date(
			`${day(offset)}T${String(hour).padStart(2, '0')}:00:00`,
		).toISOString();
	const timestamp = at(-7);
	const permissions = {
		canCreateEditProjects: true,
		canCreateEditTasks: true,
		canCreateEditReminders: true,
		canUseAi: false,
	};
	const people = [
		{
			id: userId,
			first: 'Alex',
			last: 'Morgan',
			job: 'Product Designer',
			color: '#534fff',
		},
		{
			id: 'demo-maya',
			first: 'Maya',
			last: 'Chen',
			job: 'Frontend Developer',
			color: '#15a1f1',
		},
		{
			id: 'demo-jordan',
			first: 'Jordan',
			last: 'Lee',
			job: 'UX Researcher',
			color: '#8b5cf6',
		},
		{
			id: 'demo-sam',
			first: 'Sam',
			last: 'Rivera',
			job: 'Brand Designer',
			color: '#0d9488',
		},
		{
			id: 'demo-noor',
			first: 'Noor',
			last: 'Ali',
			job: 'Project Lead',
			color: '#c026d3',
		},
	];
	const avatar = (person: (typeof people)[number]) =>
		`/portraits/${person.first.toLowerCase()}.jpg`;
	const projects = ['Website redesign', 'Design system', 'Product launch'];
	const taskNames = [
		'Refine the dashboard wireframes',
		'Review onboarding feedback',
		'Build the button component',
		'Prepare the launch checklist',
		'Update the brand guidelines',
		'Share the sprint handoff',
		'Audit mobile accessibility',
		'Document the navigation patterns',
	];
	const tasks = taskNames.map((name, i) => ({
		id: `demo-task-${i}`,
		user_id: userId,
		name,
		project_id: `demo-project-${i % 3}`,
		status: i === 1 || i === 5 ? 'done' : 'pending',
		schedule_mode: 'manual',
		time_assigned_minutes: [120, 60, 180, 90][i % 4],
		total_time_worked_minutes: [65, 60, 40, 15][i % 4],
		daily_goal_minutes: 120,
		deadline: at((i % 3) + 1, 17),
		prioritized: i === 0 || i === 2,
		repeatable: false,
		created_at: at(-3, 9 + i),
		updated_at: timestamp,
		completed_at: i === 1 || i === 5 ? at(0, 9) : null,
	}));
	const teamTasks = taskNames.map((name, i) => ({
		id: `demo-team-task-${i}`,
		organization_id: orgId,
		name,
		project_id: `demo-team-project-${i % 3}`,
		assignee_user_id: people[i % people.length].id,
		created_by: userId,
		status: i === 1 || i === 5 ? 'done' : 'pending',
		estimated_hours: [2, 1, 3, 1.5][i % 4],
		deadline: at((i % 3) + 1, 17),
		prioritized: i === 0 || i === 2,
		created_at: at(-3, 9 + i),
		completed_at: i === 1 || i === 5 ? at(0, 9) : null,
	}));
	const sessions: TemplateRow[] = [];
	for (let offset = -13; offset <= 0; offset++) {
		for (let i = 0; i < people.length; i++) {
			const seconds =
				(offset === 0 ? 110 + i * 20 : 220 + ((offset + i + 20) % 5) * 25) * 60;
			sessions.push({
				id: `demo-session-${offset}-${i}`,
				user_id: people[i].id,
				organization_id: orgId,
				task_id: i === 0 ? tasks[0].id : null,
				team_task_id: teamTasks[i].id,
				session_kind: 'work',
				started_at: at(offset, 9),
				duration_seconds: seconds,
				created_at: at(offset, 9),
			});
			sessions.push({
				id: `demo-rest-${offset}-${i}`,
				user_id: people[i].id,
				organization_id: orgId,
				session_kind: 'rest',
				started_at: at(offset, 13),
				duration_seconds: 1200,
				created_at: at(offset, 13),
			});
		}
	}
	return {
		_template: [{ version: 1, created_at: now.toISOString() }],
		local_identity: [
			{
				email: 'alex@example.com',
				user_metadata: {
					full_name: 'Alex Morgan',
					avatar_url: avatar(people[0]),
				},
			},
		],
		profiles: people.map((person) => ({
			id: person.id,
			full_name: `${person.first} ${person.last}`,
			first_name: person.first,
			last_name: person.last,
			avatar_url: avatar(person),
			job_title: person.job,
		})),
		personal: people.map((person) => ({
			id: person.id,
			user_id: person.id,
			first_name: person.first,
			last_name: person.last,
			email_address: `${person.first.toLowerCase()}@example.com`,
			profession: person.job,
			work_hours_target_daily: 6,
			app_settings: {
				workspaceMode: 'individual',
				onboardingDone: true,
				notifications: { allowAll: false },
			},
		})),
		organizations: [
			{
				id: orgId,
				name: 'Krona Studio',
				slug: 'krona-studio',
				owner_user_id: userId,
				seat_count: 5,
				billing_status: 'active',
				onboarding_completed: true,
				employee_permissions: permissions,
				role_notes: 'Fictional product team for template previews.',
				workflow_notes: 'Weekly planning, focused work, and async reviews.',
				created_at: timestamp,
			},
		],
		organization_members: people.map((person, i) => ({
			id: `demo-membership-${i}`,
			organization_id: orgId,
			user_id: person.id,
			role: i === 0 ? 'owner' : i === 4 ? 'manager' : 'member',
			status: 'active',
			job_title: person.job,
			onboarding_completed: true,
			joined_at: at(-60 - i * 10),
			hourly_rate: 45 + i * 5,
			access_permissions: permissions,
		})),
		projects: projects.map((name, i) => ({
			id: `demo-project-${i}`,
			user_id: userId,
			name,
			status: 'active',
			is_unassigned_folder: false,
			deadline: at(5 + i * 3, 17),
			created_at: timestamp,
		})),
		tasks,
		team_projects: projects.map((name, i) => ({
			id: `demo-team-project-${i}`,
			organization_id: orgId,
			name,
			status: 'active',
			created_by: userId,
			assignee_user_id: people[i].id,
			deadline: at(5 + i * 3, 17),
			is_unassigned_folder: false,
			created_at: timestamp,
		})),
		team_project_members: people.map((person, i) => ({
			id: `demo-project-member-${i}`,
			project_id: `demo-team-project-${i % 3}`,
			user_id: person.id,
		})),
		team_tasks: teamTasks,
		notes: [
			{
				id: 'demo-note-1',
				user_id: userId,
				title: 'Sprint notes',
				body: 'This week: simplify onboarding, polish the dashboard, and prepare a clear handoff for development.\n\nDesign review: bring two navigation options and accessibility notes.',
				created_at: timestamp,
				updated_at: at(0, 9),
			},
			{
				id: 'demo-note-2',
				user_id: userId,
				title: 'Ideas for the next release',
				body: 'Explore keyboard shortcuts, a clearer empty state, and a compact weekly summary for the team.',
				created_at: timestamp,
				updated_at: at(-1),
			},
		],
		reminders: ['Design review', 'Weekly planning', 'Send project update'].map(
			(name, i) => ({
				id: `demo-reminder-${i}`,
				user_id: userId,
				name,
				type: 'Event',
				due_date: day(i + 1),
				date_created: day(-3),
				occurrence: 'none',
				email_notify: false,
			}),
		),
		team_reminders: [
			'Sprint planning',
			'Client presentation',
			'Team retrospective',
		].map((name, i) => ({
			id: `demo-team-reminder-${i}`,
			organization_id: orgId,
			name,
			status: 'pending',
			due_at: at(i + 1, 11),
			assignee_user_id: i === 0 ? null : people[i].id,
			created_by: userId,
			created_at: timestamp,
			email_notify: false,
		})),
		routine: ['Plan the day', 'Deep work', 'Design review', 'Wrap up'].map(
			(name, i) => ({
				id: `demo-routine-${i}`,
				user_id: userId,
				activity_name: name,
				activity_start_time: ['09:00:00', '10:00:00', '14:00:00', '16:30:00'][
					i
				],
				activity_end_time: ['09:30:00', '12:00:00', '15:00:00', '17:00:00'][i],
				day_of_week: null,
			}),
		),
		daily_challenges: people.map((person, i) => ({
			id: `demo-challenge-${i}`,
			user_id: person.id,
			title: 'Make time for focused work',
			challenge_type: 'focus_minutes',
			target_value: 360,
			progress_value: 110 + i * 20,
			task_ids: [],
			gift_key: 'coffee',
			challenge_date: day(),
			status: 'active',
			repeat_daily: true,
			completed_at: null,
			created_at: timestamp,
			updated_at: at(0, 9),
		})),
		sessions,
		work: sessions
			.filter((row) => row.session_kind === 'work')
			.map((row) => ({
				id: `work-${row.id}`,
				user_id: row.user_id,
				work_date: String(row.started_at).slice(0, 10),
				hours_worked_daily: Number(row.duration_seconds) / 3600,
				hours_rested_daily: 1 / 3,
			})),
		team_notifications: [
			{
				id: 'demo-notification',
				organization_id: orgId,
				user_id: userId,
				kind: 'team_announcement',
				title: 'Welcome to the sample workspace',
				body: 'Explore the Manager and Employee views. All names, projects and activity are fictional.',
				read_at: null,
				created_at: at(0, 9),
			},
		],
	};
}

/** Seed once. Existing rows and edited settings win over the sample content. */
export function withTemplateData(
	existing: TemplateDatabase,
	now = new Date(),
): TemplateDatabase {
	if (
		existing.organizations?.some(
			(row) => row.id === TEMPLATE_ORG_ID && row.name === 'Forma Studio',
		)
	) {
		existing = {
			...existing,
			organizations: existing.organizations.map((row) =>
				row.id === TEMPLATE_ORG_ID && row.name === 'Forma Studio'
					? { ...row, name: 'Krona Studio', slug: 'krona-studio' }
					: row,
			),
		};
	}
	// Older seeded workspaces may still contain the original Local User identity.
	const oldPersonal = existing.personal?.some(
		(row) =>
			row.user_id === TEMPLATE_USER_ID &&
			row.first_name === 'Local' &&
			row.last_name === 'User',
	);
	const oldProfile = existing.profiles?.some(
		(row) =>
			row.id === TEMPLATE_USER_ID &&
			['Local workspace', 'Local User'].includes(String(row.full_name)),
	);
	if (oldPersonal || oldProfile) {
		existing = {
			...existing,
			personal: (existing.personal ?? []).map((row) =>
				row.user_id === TEMPLATE_USER_ID &&
				row.first_name === 'Local' &&
				row.last_name === 'User'
					? { ...row, first_name: 'Alex', last_name: 'Morgan' }
					: row,
			),
			profiles: (existing.profiles ?? []).map((row) =>
				row.id === TEMPLATE_USER_ID &&
				['Local workspace', 'Local User'].includes(String(row.full_name))
					? {
							...row,
							full_name: 'Alex Morgan',
							first_name: 'Alex',
							last_name: 'Morgan',
						}
					: row,
			),
		};
	}
	// Upgrade only the original SVG initials, without resetting saved work.
	const portraitById: Record<string, string> = {
		[TEMPLATE_USER_ID]: '/portraits/alex.jpg',
		'demo-maya': '/portraits/maya.jpg',
		'demo-jordan': '/portraits/jordan.jpg',
		'demo-sam': '/portraits/sam.jpg',
		'demo-noor': '/portraits/noor.jpg',
	};
	const originalAvatars = [['AM', '#534fff'], ['MC', '#15a1f1'], ['JL', '#8b5cf6'], ['SR', '#0d9488'], ['NA', '#c026d3']].map(([initials, color]) =>
		`data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect width="80" height="80" rx="24" fill="${color}"/><text x="40" y="49" text-anchor="middle" font-family="sans-serif" font-size="27" fill="white">${initials}</text></svg>`)}`,
	);
	const isInitials = (url: unknown) => typeof url === 'string' && originalAvatars.includes(url);
	if (existing.profiles?.some((row) => portraitById[String(row.id)] && isInitials(row.avatar_url))) {
		existing = {
			...existing,
			profiles: existing.profiles.map((row) => portraitById[String(row.id)] && isInitials(row.avatar_url) ? { ...row, avatar_url: portraitById[String(row.id)] } : row),
			local_identity: (existing.local_identity ?? []).map((row) => {
				const meta = row.user_metadata as Record<string, unknown> | undefined;
				return isInitials(meta?.avatar_url) ? { ...row, user_metadata: { ...meta, avatar_url: portraitById[TEMPLATE_USER_ID] } } : row;
			}),
		};
	}
	if (existing._template?.some((row) => row.version === 1)) return existing;
	const sample = createTemplateData(now);
	const merged = { ...existing };
	for (const [table, rows] of Object.entries(sample)) {
		const current = existing[table] ?? [];
		const key = table === 'personal' ? 'user_id' : 'id';
		merged[table] =
			table === 'local_identity' && current.length
				? current
				: [
						...current,
						...rows.filter(
							(row) =>
								!current.some(
									(saved) => saved[key] != null && saved[key] === row[key],
								),
						),
					];
	}
	// Upgrade the original empty-workspace placeholders, preserving custom profiles.
	const currentPersonal = merged.personal?.find(
		(row) => row.user_id === TEMPLATE_USER_ID,
	);
	if (
		currentPersonal?.first_name === 'Local' &&
		currentPersonal?.last_name === 'User'
	) {
		Object.assign(currentPersonal, {
			first_name: 'Alex',
			last_name: 'Morgan',
			profession: 'Product Designer',
		});
	}
	const currentProfile = merged.profiles?.find(
		(row) => row.id === TEMPLATE_USER_ID,
	);
	if (currentProfile?.full_name === 'Local workspace') {
		Object.assign(currentProfile, sample.profiles[0]);
	}
	merged._template = sample._template;
	return merged;
}
