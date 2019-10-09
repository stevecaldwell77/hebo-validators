const Joi = require('@hapi/joi');
const forIn = require('lodash/forIn');

class AggregateNotFoundError extends Error {
    constructor(aggregateName, aggregateId) {
        super(
            `cannot find aggregate "${aggregateName}" with id "${aggregateId}"`,
        );
        this.name = this.constructor.name;
        Error.captureStackTrace(this, this.constructor);
        this.aggregateName = aggregateName;
        this.aggregateId = aggregateId;
    }
}

class DuplicateAggregateError extends Error {
    constructor(aggregateName, aggregateId) {
        super(`"${aggregateName}" with id "${aggregateId}" already exists`);
        this.name = this.constructor.name;
        Error.captureStackTrace(this, this.constructor);
        this.aggregateName = aggregateName;
        this.aggregateId = aggregateId;
    }
}

class EventPayloadError extends Error {
    constructor(event, key) {
        const message = `event payload missing "${key}"`;
        super(message);
        this.name = this.constructor.name;
        Error.captureStackTrace(this, this.constructor);
        this.event = event;
        this.key = key;
    }
}

class InvalidAggregateError extends Error {
    constructor(message, aggregateName) {
        super(`invalid aggregate "${aggregateName}": ${message}`);
        this.name = this.constructor.name;
        Error.captureStackTrace(this, this.constructor);
        this.aggregateName = aggregateName;
    }
}

class InvalidEventError extends Error {
    constructor(message, event) {
        super(message);
        this.name = this.constructor.name;
        Error.captureStackTrace(this, this.constructor);
        this.event = event;
    }
}

class InvalidCommandError extends Error {
    constructor(message, aggregateName, commandName) {
        super(
            `aggregate "${aggregateName}": command "${commandName}" ` +
                `is invalid: ${message}`,
        );
        this.name = this.constructor.name;
        Error.captureStackTrace(this, this.constructor);
        this.aggregateName = aggregateName;
        this.commandName = commandName;
    }
}

class InvalidCommandParamsError extends Error {
    constructor(message, aggregateName, commandName) {
        super(
            `aggregate "${aggregateName}": command "${commandName}" ` +
                `called with invalid params: ${message}`,
        );
        this.name = this.constructor.name;
        Error.captureStackTrace(this, this.constructor);
        this.aggregateName = aggregateName;
        this.commandName = commandName;
    }
}

class InvalidProjectionError extends Error {
    constructor(message, aggregateName) {
        super(
            `aggregate "${aggregateName}" has an invalid projection: ` +
                `${message}`,
        );
        this.name = this.constructor.name;
        Error.captureStackTrace(this, this.constructor);
        this.aggregateName = aggregateName;
    }
}

class InvariantViolatedError extends Error {
    constructor(aggregateName, aggregateId, state, message) {
        super(message);
        this.name = this.constructor.name;
        Error.captureStackTrace(this, this.constructor);
        this.aggregateName = aggregateName;
        this.aggregateId = aggregateId;
        this.state = state;
    }
}

class MaxCommandAttemptsError extends Error {
    constructor(aggregateName, commandName, attempts) {
        super(
            `aggregate "${aggregateName}": command "${commandName}" failed ` +
                `after ${attempts} attempts`,
        );
        this.name = this.constructor.name;
        Error.captureStackTrace(this, this.constructor);
        this.aggregateName = aggregateName;
        this.commandName = commandName;
        this.attempts = attempts;
    }
}

class UnauthorizedError extends Error {
    constructor(operation, userDesc) {
        const message = `user ${userDesc} is not allowed to call ${operation.type} on ${operation.aggregateName} ${operation.aggregateId}`;
        super(message);
        this.name = this.constructor.name;
        Error.captureStackTrace(this, this.constructor);
        this.operation = operation;
        this.userDesc = userDesc;
    }
}

class UnknownAggregateError extends Error {
    constructor(aggregateName) {
        const message = `unknown aggregate "${aggregateName}"`;
        super(message);
        this.name = this.constructor.name;
        Error.captureStackTrace(this, this.constructor);
        this.aggregateName = aggregateName;
    }
}

class UnknownCommandError extends Error {
    constructor(aggregateName, commandName) {
        const message =
            `aggregate "${aggregateName}": unknown command ` +
            `"${commandName}"`;
        super(message);
        this.name = this.constructor.name;
        Error.captureStackTrace(this, this.constructor);
        this.aggregateName = aggregateName;
        this.commandName = commandName;
    }
}

class UnknownEventTypeError extends Error {
    constructor(eventType) {
        const message = `unknown event type "${eventType}"`;
        super(message);
        this.name = this.constructor.name;
        Error.captureStackTrace(this, this.constructor);
        this.eventType = eventType;
    }
}

const errorDetailsMessage = error =>
    error.details.map(d => d.message).join(', ');

const eventSchema = Joi.object()
    .keys({
        aggregateName: Joi.string().required(),
        aggregateId: Joi.alternatives()
            .try(Joi.number(), Joi.string())
            .required(),
        eventId: Joi.alternatives()
            .try(Joi.number(), Joi.string())
            .required(),
        type: Joi.string().required(),
        metadata: Joi.object().required(),
        payload: Joi.object().required(),
        sequenceNumber: Joi.number()
            .integer()
            .greater(0)
            .required(),
    })
    .unknown();

const validateEvent = event => {
    const { error } = eventSchema.validate(event);

    if (error) {
        const messages = error.details.map(d => d.message);
        const message = messages.join(', ');
        throw new InvalidEventError(message, event);
    }
};

const aggregateSchema = Joi.object()
    .keys({
        idField: Joi.string().required(),
        projection: Joi.object().required(),
        commands: Joi.object().required(),
    })
    .unknown();

const projectionSchema = Joi.object()
    .keys({
        initialState: Joi.func().required(),
        applyEvent: Joi.func().required(),
        validateState: Joi.func().required(),
    })
    .unknown();

const commandSchema = Joi.object()
    .keys({
        validateParams: Joi.func().required(),
        createEvent: Joi.func().required(),
        isCreateCommand: Joi.boolean(),
        retries: Joi.number()
            .integer()
            .positive(),
    })
    .unknown();

const validateAggregate = (aggregate, aggregateName) => {
    const { error: aggregateError } = aggregateSchema.validate(aggregate);
    if (aggregateError) {
        throw new InvalidAggregateError(
            errorDetailsMessage(aggregateError),
            aggregateName,
        );
    }

    const { error: projectionError } = projectionSchema.validate(
        aggregate.projection,
    );
    if (projectionError) {
        throw new InvalidProjectionError(
            errorDetailsMessage(projectionError),
            aggregateName,
        );
    }

    forIn(aggregate.commands, (command, commandName) => {
        const { error: commandError } = commandSchema.validate(command);
        if (commandError) {
            throw new InvalidCommandError(
                errorDetailsMessage(commandError),
                aggregateName,
                commandName,
            );
        }
    });
};

const eventRepositorySchema = Joi.object()
    .keys({
        getEvents: Joi.func().required(),
        writeEvent: Joi.func().required(),
    })
    .unknown();

const validateEventRepository = r => eventRepositorySchema.validate(r);

const snapshotRepositorySchema = Joi.object()
    .keys({
        getSnapshot: Joi.func().required(),
        writeSnapshot: Joi.func().required(),
    })
    .unknown();

const validateSnapshotRepository = r => snapshotRepositorySchema.validate(r);

const notificationHandlerSchema = Joi.object()
    .keys({
        invalidEventsFound: Joi.func().required(),
        eventWritten: Joi.func().required(),
    })
    .unknown();

const validateNotificationHandler = r => notificationHandlerSchema.validate(r);

const authorizerSchema = Joi.object()
    .keys({
        assert: Joi.func().required(),
    })
    .unknown();

module.exports = {
    authorizerSchema,
    eventRepositorySchema,
    notificationHandlerSchema,
    snapshotRepositorySchema,
    validateAggregate,
    validateEvent,
    validateEventRepository,
    validateNotificationHandler,
    validateSnapshotRepository,
    AggregateNotFoundError,
    DuplicateAggregateError,
    EventPayloadError,
    InvalidAggregateError,
    InvalidCommandError,
    InvalidCommandParamsError,
    InvalidEventError,
    InvalidProjectionError,
    InvariantViolatedError,
    MaxCommandAttemptsError,
    UnauthorizedError,
    UnknownAggregateError,
    UnknownCommandError,
    UnknownEventTypeError,
};
