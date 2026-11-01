'use client';

import { localService } from '@/lib/localService';

import { localData } from '@/lib/localData';
import { getURL } from '@/utils/helpers';
import {
	activeMemberDrafts,
	memberDraftToStoredProfile,
	type OnboardingMemberDraft,
	type StoredMemberProfile,
} from '@/lib/teams/memberProfile';

export type DurableOrganizationInvite = {
	id: string;
	email: string;
	inviteUrl: string;
	deliveryStatus: 'queued' | 'sent' | 'failed';
	error?: string;
};

export async function createReliableOrganizationInvites(input: {
	organizationId: string;
	invitedBy: string;
	members: OnboardingMemberDraft[];
}): Promise<{
	invites: DurableOrganizationInvite[];
	sent: string[];
	queued: string[];
	failed: string[];
	emailError?: string;
}> {
	try {
		const response = await localService('teams/invite', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				action: 'create',
				organizationId: input.organizationId,
				members: input.members,
			}),
		});
		const body = (await response.json().catch(() => ({}))) as {
			error?: string;
			invites?: DurableOrganizationInvite[];
			failures?: Array<{ email: string; error: string }>;
		};
		const invites = body.invites ?? [];
		const failed = (body.failures ?? []).map((failure) => failure.email);
		if (!response.ok && !invites.length) {
			return {
				invites: [],
				sent: [],
				queued: [],
				failed: input.members.map((member) => member.email.trim()).filter(Boolean),
				emailError: body.error || 'Could not create invites.',
			};
		}
		return {
			invites,
			sent: invites
				.filter((invite) => invite.deliveryStatus === 'sent')
				.map((invite) => invite.email),
			queued: invites
				.filter((invite) => invite.deliveryStatus !== 'sent')
				.map((invite) => invite.email),
			failed,
			emailError:
				body.error || (body.failures?.length ? body.failures[0].error : undefined),
		};
	} catch (error) {
		return {
			invites: [],
			sent: [],
			queued: [],
			failed: input.members.map((member) => member.email.trim()).filter(Boolean),
			emailError: error instanceof Error ? error.message : 'Network error',
		};
	}
}

/** Attach manager-provided AI context to pending invite profiles without resending. */
export async function updatePendingInviteAiInstructions(input: {
	organizationId: string;
	members: OnboardingMemberDraft[];
	instructions: string;
}): Promise<boolean> {
	const instructions = input.instructions.trim();
	if (!instructions) return false;

	let ok = true;
	for (const draft of activeMemberDrafts(input.members)) {
		const email = draft.email.trim().toLowerCase();
		const profile = {
			...memberDraftToStoredProfile(draft),
			aiInstructions: instructions,
		};
		const { error } = await localData
			.from('organization_invites')
			.update({ member_profile: profile })
			.eq('organization_id', input.organizationId)
			.eq('email', email)
			.eq('status', 'pending');
		if (error) {
			ok = false;
			console.warn(
				'[teams/invites] AI instructions update failed',
				error.message,
			);
		}
	}
	return ok;
}

/** Revoke leftover pending invites that cannot take a seat anymore. */
export async function reconcilePendingOrgInvites(
	organizationId: string,
): Promise<void> {
	try {
		await localService('teams/invite', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				action: 'reconcile',
				organizationId,
			}),
		});
	} catch {
		/* seat count still filters expired / duplicate invites */
	}
}

export function teamInviteAcceptUrl(token: string): string {
	return getURL(`/teams/join/${token}`);
}

export async function acceptInviteByToken(token: string): Promise<{
	ok: boolean;
	organizationId?: string;
	organizationName?: string;
	memberProfile?: StoredMemberProfile | null;
	alreadyMember?: boolean;
	error?: string;
}> {
	try {
		const response = await localService('teams/invite/accept', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ token }),
		});
		const body = (await response.json().catch(() => ({}))) as {
			ok?: boolean;
			organizationId?: string;
			organizationName?: string;
			memberProfile?: StoredMemberProfile | null;
			alreadyMember?: boolean;
			error?: string;
		};
		if (!response.ok || !body.ok) {
			return { ok: false, error: body.error || 'Could not accept invite.' };
		}
		return {
			ok: true,
			organizationId: body.organizationId,
			organizationName: body.organizationName,
			memberProfile: body.memberProfile ?? null,
			alreadyMember: body.alreadyMember,
		};
	} catch {
		return { ok: false, error: 'Could not accept invite. Please try again.' };
	}
}
