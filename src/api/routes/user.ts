import Elysia, { t } from 'elysia';
import { db } from '$db/db';
import { User } from '$db/generated/schema/User';
import { permissionsPlugin } from '$api/auth/permissions';
import { CRUDMaker } from '$api/util/crudmaker';
import { dynamicPublicConfig } from '$config/public';

export const user = new Elysia({
	normalize: true
})
	.use(CRUDMaker.getAll('user'))
	.use(CRUDMaker.createOne('user'))
	.use(CRUDMaker.updateOne('user'))
	.use(CRUDMaker.deleteOne('user'))
	.use(permissionsPlugin)
	.get(
		'/user/:id',
		async ({ params, permissions }) => {
			return db.user.findUniqueOrThrow({
				where: { id: params.id },
				include: {
					delegationMemberships: {
						where: permissions.allowDatabaseAccessTo('read').DelegationMember
					},
					singleParticipant: {
						where: permissions.allowDatabaseAccessTo('read').SingleParticipant
					},
					conferenceParticipantStatus: {
						where: permissions.allowDatabaseAccessTo('read').ConferenceParticipantStatus
					},
					conferenceSupervisor: {
						where: permissions.allowDatabaseAccessTo('read').ConferenceSupervisor
					},
					teamMember: {
						where: permissions.allowDatabaseAccessTo('read').TeamMember
					}
				}
			});
		},
		{
			response: User
		}
	)
	.patch(
		'/user/upsert-after-login',
		async ({ permissions }) => {
			const user = permissions.mustBeLoggedIn();

			if (!user.email || !user.family_name || !user.given_name || !user.preferred_username) {
				throw new Error('OIDC result is missing required fields!');
			}

			const updatedUser = await db.user.upsert({
				where: { id: user.sub },
				create: {
					id: user.sub,
					email: user.email,
					family_name: user.family_name,
					given_name: user.given_name,
					preferred_username: user.preferred_username,
					locale: user.locale ?? dynamicPublicConfig.DEFAULT_LOCALE,
					phone: (user as any)['phone'] ? (user as any)['phone'] : undefined
				},
				update: {
					email: user.email,
					family_name: user.family_name,
					given_name: user.given_name,
					preferred_username: user.preferred_username,
					locale: user.locale ?? dynamicPublicConfig.DEFAULT_LOCALE,
					phone: (user as any)['phone'] ? (user as any)['phone'] : undefined
				}
			});

			const requiredFields = [
				'birthday',
				'phone',
				'street',
				'zip',
				'city',
				'country',
				'gender',
				'foodPreference'
			];

			// @ts-expect-error - TS doesn't know about the user object keys
			const userNeedsAdditionalInfo = requiredFields.some((field) => !updatedUser[field]);

			return { userNeedsAdditionalInfo };
		},
		{
			response: t.Object({ userNeedsAdditionalInfo: t.Boolean() })
		}
	);
