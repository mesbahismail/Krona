/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint @typescript-eslint/no-unused-vars: ["warn", { "argsIgnorePattern": "^_" }] */
import { withTemplateData } from '@/lib/templateData';

// The template's tables have different shapes. Keep the query boundary dynamic;
// feature modules continue to define their own task, project and settings types.
type Row = Record<string, any>;
type LocalError = { message: string; code?: string };
type Result<T> = { data: T; error: LocalError | null; count: number | null };
const STORAGE_KEY = 'krona:local-data:v1';
const USER_ID = '00000000-0000-4000-8000-000000000001';
type Database = Record<string, Row[]>;

function read(): Database {
	if (typeof window === 'undefined') return {};
	const stored = window.localStorage.getItem(STORAGE_KEY);
	const existing: Database = stored ? JSON.parse(stored) : {};
	const database = withTemplateData(existing);
	if (database !== existing)
		window.localStorage.setItem(STORAGE_KEY, JSON.stringify(database));
	return database;
}

function write(database: Database) {
	if (typeof window === 'undefined')
		throw new Error('Local data is only available in the browser.');
	window.localStorage.setItem(STORAGE_KEY, JSON.stringify(database));
}

function errorMessage(error: unknown): LocalError {
	return {
		message:
			error instanceof Error
				? error.message
				: 'Could not save data on this device.',
	};
}

type Predicate = (row: Row) => boolean;
class LocalQuery<Single extends boolean = false> implements PromiseLike<
	Result<Single extends true ? any : any[]>
> {
	private predicates: Predicate[] = [];
	private operation: 'select' | 'insert' | 'update' | 'upsert' | 'delete' =
		'select';
	private values: Row[] = [];
	private conflict = ['id'];
	private sorts: { column: string; ascending: boolean }[] = [];
	private start = 0;
	private end = Infinity;
	private one = false;
	private required = false;
	private head = false;
	private columns = '*';
	private execution?: Promise<Result<any>>;
	constructor(private table: string) {}
	select(columns = '*', options?: { count?: string; head?: boolean }) {
		this.columns = columns;
		this.head = options?.head ?? false;
		return this;
	}
	insert(values: Row | Row[]) {
		this.operation = 'insert';
		this.values = Array.isArray(values) ? values : [values];
		return this;
	}
	update(values: Row) {
		this.operation = 'update';
		this.values = [values];
		return this;
	}
	upsert(values: Row | Row[], options?: { onConflict?: string }) {
		this.insert(values);
		this.operation = 'upsert';
		this.conflict = options?.onConflict?.split(',').map((s) => s.trim()) ?? [
			'id',
		];
		return this;
	}
	delete() {
		this.operation = 'delete';
		return this;
	}
	eq(column: string, value: unknown) {
		this.predicates.push((row) => row[column] === value);
		return this;
	}
	neq(column: string, value: unknown) {
		this.predicates.push((row) => row[column] != null && row[column] !== value);
		return this;
	}
	in(column: string, values: unknown[]) {
		this.predicates.push((row) => values.includes(row[column]));
		return this;
	}
	is(column: string, value: unknown) {
		this.predicates.push((row) =>
			value === null ? row[column] == null : row[column] === value,
		);
		return this;
	}
	gte(column: string, value: any) {
		this.predicates.push((row) => row[column] != null && row[column] >= value);
		return this;
	}
	lte(column: string, value: any) {
		this.predicates.push((row) => row[column] != null && row[column] <= value);
		return this;
	}
	gt(column: string, value: any) {
		this.predicates.push((row) => row[column] != null && row[column] > value);
		return this;
	}
	lt(column: string, value: any) {
		this.predicates.push((row) => row[column] != null && row[column] < value);
		return this;
	}
	not(column: string, operator: string, value: unknown) {
		if (operator !== 'is')
			throw new Error(`Unsupported local filter: not ${operator}`);
		this.predicates.push((row) =>
			value === null ? row[column] != null : row[column] !== value,
		);
		return this;
	}
	or(expression: string) {
		const alternatives = (expression.match(/[^,()]+(?:\([^)]*\))?/g) ?? []).map(
			(part) => {
				const [column, operator, ...rest] = part.split('.');
				const raw = rest.join('.');
				const value = raw === 'null' ? null : raw;
				if (operator === 'in') {
					const values = raw.replace(/^\(|\)$/g, '').split(',');
					return (row: Row) => values.includes(String(row[column]));
				}
				if (operator !== 'eq' && operator !== 'is')
					throw new Error(`Unsupported local filter: ${operator}`);
				return (row: Row) =>
					operator === 'is' && value === null
						? row[column] == null
						: String(row[column]) === String(value);
			},
		);
		this.predicates.push((row) => alternatives.some((matches) => matches(row)));
		return this;
	}
	order(
		column: string,
		options?: { ascending?: boolean; nullsFirst?: boolean },
	) {
		this.sorts.push({ column, ascending: options?.ascending ?? true });
		return this;
	}
	limit(count: number) {
		this.end = this.start + count;
		return this;
	}
	range(start: number, end: number) {
		this.start = start;
		this.end = end + 1;
		return this;
	}
	single() {
		this.one = true;
		this.required = true;
		return this as unknown as LocalQuery<true>;
	}
	maybeSingle() {
		this.one = true;
		return this as unknown as LocalQuery<true>;
	}

	private execute(): Result<any> {
		try {
			const db = read();
			const rows = db[this.table] ?? [];
			const matches = (row: Row) =>
				this.predicates.every((predicate) => predicate(row));
			let selected = rows.filter(matches);
			if (this.operation === 'insert' || this.operation === 'upsert') {
				selected = this.values.map((value) => {
					const existing =
						this.operation === 'upsert'
							? rows.find((row) =>
									this.conflict.every(
										(key) => value[key] != null && row[key] === value[key],
									),
								)
							: undefined;
					if (existing) {
						Object.assign(existing, value);
						return existing;
					}
					const row = {
						id: crypto.randomUUID(),
						created_at: new Date().toISOString(),
						...(['tasks', 'projects', 'team_tasks', 'team_projects'].includes(
							this.table,
						)
							? {
									status: 'pending',
									total_time_worked_minutes: 0,
									prioritized: false,
								}
							: {}),
						...value,
					};
					rows.push(row);
					return row;
				});
			} else if (this.operation === 'update') {
				selected.forEach((row) => Object.assign(row, this.values[0]));
			}
			if (this.operation !== 'select') {
				db[this.table] =
					this.operation === 'delete'
						? rows.filter((row) => !matches(row))
						: rows;
				write(db);
			}
			const count = selected.length;
			selected = [...selected]
				.sort((a, b) => {
					for (const { column, ascending } of this.sorts) {
						if (a[column] === b[column]) continue;
						return (
							(a[column] == null
								? 1
								: b[column] == null
									? -1
									: a[column] < b[column]
										? -1
										: 1) * (ascending ? 1 : -1)
						);
					}
					return 0;
				})
				.slice(this.start, this.end);
			if (
				this.one &&
				(selected.length > 1 || (this.required && !selected.length))
			)
				return {
					data: null,
					error: { message: 'Expected one local record.', code: 'PGRST116' },
					count,
				};
			// Resolve the two local relationships used by performance reports.
			selected = selected.map((row) => {
				const expanded = { ...row };
				if (this.columns.includes('projects('))
					expanded.projects =
						(db.projects ?? []).find(
							(project) => project.id === row.project_id,
						) ?? null;
				if (this.columns.includes('tasks('))
					expanded.tasks =
						(db.tasks ?? []).find((task) => task.id === row.task_id) ?? null;
				return expanded;
			});
			return {
				data: this.head ? null : this.one ? (selected[0] ?? null) : selected,
				error: null,
				count,
			};
		} catch (error) {
			return {
				data: this.one ? null : [],
				error: errorMessage(error),
				count: null,
			};
		}
	}
	then<TResult1 = Result<Single extends true ? any : any[]>, TResult2 = never>(
		onfulfilled?:
			| ((
					value: Result<Single extends true ? any : any[]>,
			  ) => TResult1 | PromiseLike<TResult1>)
			| null,
		onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null,
	): PromiseLike<TResult1 | TResult2> {
		this.execution ??= Promise.resolve().then(() => this.execute());
		return this.execution.then(onfulfilled, onrejected);
	}
}

function localUser() {
	const profile = read().local_identity?.[0] ?? {};
	return {
		id: USER_ID,
		email: profile.email ?? '',
		user_metadata: profile.user_metadata ?? {
			full_name: 'Alex Morgan',
			first_name: 'Alex',
			last_name: 'Morgan',
		},
		app_metadata: {},
		created_at: '2026-01-01T00:00:00.000Z',
	};
}

const unavailable = {
	message: 'This service is unavailable in the local template.',
};
export const localData = {
	from: (table: string) => new LocalQuery(table),
	auth: {
		async getUser(): Promise<{
			data: { user: ReturnType<typeof localUser> };
			error: LocalError | null;
		}> {
			return { data: { user: localUser() }, error: null };
		},
		async updateUser(input: { data?: Row; email?: string; password?: string }) {
			try {
				const db = read();
				const user = localUser();
				db.local_identity = [
					{
						email: input.email ?? user.email,
						user_metadata: { ...user.user_metadata, ...input.data },
					},
				];
				write(db);
				return { data: { user: localUser() }, error: null };
			} catch (error) {
				return { data: { user: null }, error: errorMessage(error) };
			}
		},
		onAuthStateChange(_callback: (event: string) => void) {
			return { data: { subscription: { unsubscribe() {} } } };
		},
		async signOut() {
			return { error: null };
		},
	},
	channel(_name: string) {
		// There is no remote realtime connection in the local template.
		const channel = {
			on(_event: string, _filter: Row, _callback: (...args: any[]) => void) {
				return channel;
			},
			subscribe() {
				return channel;
			},
			unsubscribe() {},
		};
		return channel;
	},
	async removeChannel(_channel: unknown) {},
	async rpc(name: string, args?: Row): Promise<Result<Row[]>> {
		if (name === 'org_member_directory') {
			const db = read();
			const members = (db.organization_members ?? []).filter(
				(row) => row.organization_id === args?.p_organization_id,
			);
			const data = members.map((member) => {
				const profile = db.profiles?.find((row) => row.id === member.user_id);
				const personal = db.personal?.find(
					(row) => row.user_id === member.user_id,
				);
				return {
					user_id: member.user_id,
					display_name: profile?.full_name,
					email: personal?.email_address,
					avatar_url: profile?.avatar_url,
					work_hours_target_daily: personal?.work_hours_target_daily,
				};
			});
			return { data, error: null, count: data.length };
		}
		return { data: [], error: unavailable, count: null };
	},
	storage: {
		from(bucket: string) {
			return {
				async upload(path: string, file: File, _options?: Row) {
					try {
						const url = await new Promise<string>((resolve, reject) => {
							const reader = new FileReader();
							reader.onload = () => resolve(String(reader.result));
							reader.onerror = () => reject(reader.error);
							reader.readAsDataURL(file);
						});
						const result = await localData
							.from('local_files')
							.upsert({ id: `${bucket}/${path}`, bucket, path, url });
						return { data: { path }, error: result.error };
					} catch (error) {
						return { data: null, error: errorMessage(error) };
					}
				},
				getPublicUrl(path: string) {
					return {
						data: {
							publicUrl:
								read().local_files?.find(
									(row) => row.id === `${bucket}/${path}`,
								)?.url ?? '',
						},
					};
				},
				async list(prefix: string) {
					return {
						data: (read().local_files ?? [])
							.filter(
								(row) =>
									row.bucket === bucket && row.path.startsWith(`${prefix}/`),
							)
							.map((row) => ({ name: row.path.slice(prefix.length + 1) })),
						error: null,
					};
				},
				async remove(paths: string[]) {
					return localData
						.from('local_files')
						.delete()
						.in(
							'id',
							paths.map((path) => `${bucket}/${path}`),
						);
				},
			};
		},
	},
};
export type LocalDataClient = typeof localData;
