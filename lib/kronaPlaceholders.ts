/** Contextual placeholder copy for empty text fields and search bars. */
export const kronaPlaceholders = {
	search: {
		notes: 'Search notes',
		reminders: 'Search reminders',
		projects: 'Search projects and tasks',
		tasks: 'Search for a task',
	},
	auth: {
		email: 'name@example.com',
		password: 'Password',
		passwordMask: '••••••••',
		firstName: 'Jon',
		lastName: 'Doe',
		birthDate: 'DD/MM/YYYY',
	},
	account: {
		fullName: 'Your full name',
		newPassword: 'New password',
		confirmPassword: 'Confirm new password',
	},
	password: {
		current: 'Current password',
		new: 'New password',
		confirm: 'Confirm new password',
	},
	settings: {
		name: 'Your name',
		email: 'name@example.com',
		workMinutes: 'e.g. 25',
		shortBreakMinutes: 'e.g. 5',
		longBreakMinutes: 'e.g. 15',
	},
	notes: {
		untitled: 'Untitled',
		prose: 'Type / for commands',
		proseContinue: 'Type / for commands',
		task: 'Task',
		folderName: 'Folder name',
		projectName: 'Project name',
		tableHeader: 'Header',
		tableCell: 'Cell',
	},
	reminders: {
		name: 'Reminder name',
		date: 'Select date',
		subscriptionValue: 'e.g. 9.99',
	},
	projects: {
		name: 'Project name',
		taskName: 'Task name',
		hours: 'Hours',
		deadlineToolbar: 'Deadline',
		headerTitle: 'Project name',
		editTask: 'Task name',
		deadline: 'Select deadline',
		totalHours: 'e.g. 8',
		dailyGoal: 'e.g. 2',
	},
	dashboard: {
		taskName: 'Task name',
		projectName: 'Project name',
		assignedHours: 'e.g. 1.5',
		deadline: 'Select deadline',
	},
	challenges: {
		focusHours: 'e.g. 2',
		restHours: 'e.g. 1',
	},
	routine: {
		activity: 'Activity',
		title: 'My routine',
	},
	help: {
		subject: 'Subject',
		message: 'What do you need help with?',
	},
	feedback: {
		message: "What's on your mind?",
	},
} as const;
