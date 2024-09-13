import { ForbiddenError } from '@casl/ability';
import {
	PrismaClientInitializationError,
	PrismaClientKnownRequestError,
	PrismaClientRustPanicError,
	PrismaClientUnknownRequestError,
	PrismaClientValidationError
} from '@prisma/client/runtime/library';
import Elysia from 'elysia';
import { PermissionCheckError } from '../auth/permissions';

//TODO see if we still need this when using graphql

export const logger = new Elysia({
	name: 'logger'
})
	// these are errors which can occur in the app
	// we can register them here to gain type safety in our onError handler
	.error({
		PrismaClientKnownRequestError,
		PrismaClientUnknownRequestError,
		PrismaClientRustPanicError,
		PrismaClientInitializationError,
		PrismaClientValidationError,
		ForbiddenError,
		PermissionCheckError
	})
	.derive({ as: 'global' }, () => {
		return {
			requestId: Math.random().toString(36).substring(7)
		};
	})
	.onBeforeHandle({ as: 'global' }, ({ request, path, requestId }) => {
		console.info(`[${requestId}]: Received request ${request.method} ${path}`);
	})
	.onAfterHandle({ as: 'global' }, ({ request, path, set, requestId }) => {
		console.info(
			`[${requestId}]: Handled request ${request.method} ${path} with status ${set.status}`
		);
	})
	.onError({ as: 'global' }, ({ error, code, path, set, request }) => {
		console.error(
			`Error in ${request.method} ${path}: ${code} ${error.message}. Thrown at ${error.stack}. \n ${JSON.stringify(error)}`
		);

		// Built-in elysia errors

		if (code === 'VALIDATION') {
			return error.message;
		}

		if (code === 'NOT_FOUND') {
			return `Path ${path} doesn't exist (${error.message})`;
		}

		if (code === 'ForbiddenError' || code === 'PermissionCheckError') {
			set.status = 'Forbidden';
			return error.message ?? "You don't have permission to do that";
		}

		//TODO code is not typed correctly for prisma errors?
		if (code === 'PrismaClientKnownRequestError') {
			if (error.code === 'P2025' || error.code === 'P2002') {
				return error.message;
			}
		}

		set.status = 'Internal Server Error';
		return 'Internal server error';
	});
