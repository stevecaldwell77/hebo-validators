const test = require('ava');
const shortid = require('shortid');
const { omit, noop } = require('lodash');
const {
    validateEvent,
    validateAggregate,
    validateEventRepository,
    validateNotificationHandler,
    validateSnapshotRepository,
    AggregateNotFoundError,
    DuplicateAggregateError,
    EventPayloadError,
    InvalidCommandParamsError,
    InvalidEventError,
    InvariantViolatedError,
    MaxCommandAttemptsError,
    UnauthorizedError,
    UnknownAggregateError,
    UnknownCommandError,
    UnknownEventTypeError,
} = require('..');

test('validateEvent()', t => {
    const validEvent = {
        aggregateName: 'user',
        aggregateId: shortid.generate(),
        eventId: shortid.generate(),
        type: 'CREATE',
        payload: {},
        metadata: {},
        sequenceNumber: 1,
    };

    t.notThrows(() => validateEvent(validEvent), 'valid event passes');

    t.throws(
        () => validateEvent({}),
        InvalidEventError,
        'throws InvalidEventError',
    );

    t.throws(
        () => validateEvent(omit(validEvent, 'aggregateName')),
        /"aggregateName" is required/,
        'aggregateName required',
    );

    t.throws(
        () => validateEvent({ ...validEvent, aggregateName: {} }),
        /aggregateName" must be a string/,
        'aggregateName must be correct type',
    );

    t.throws(
        () => validateEvent(omit(validEvent, 'aggregateId')),
        /"aggregateId" is required/,
        'aggregateId required',
    );

    t.throws(
        () => validateEvent({ ...validEvent, aggregateId: {} }),
        '"aggregateId" must be one of [number, string]',
        'aggregateId must be correct type',
    );

    t.throws(
        () => validateEvent(omit(validEvent, 'type')),
        /"type" is required/,
        'type required',
    );

    t.throws(
        () => validateEvent({ ...validEvent, type: 10 }),
        /"type" must be a string/,
        'type must be string',
    );

    t.throws(
        () => validateEvent({ ...validEvent, eventId: {} }),
        '"eventId" must be one of [number, string]',
        'eventId must be correct type',
    );

    t.throws(
        () => validateEvent(omit(validEvent, 'type')),
        /"type" is required/,
        'type required',
    );

    t.throws(
        () => validateEvent({ ...validEvent, type: 10 }),
        /"type" must be a string/,
        'type must be string',
    );

    t.throws(
        () => validateEvent(omit(validEvent, 'payload')),
        /"payload" is required/,
        'payload required',
    );

    t.throws(
        () => validateEvent({ ...validEvent, payload: 10 }),
        '"payload" must be of type object',
        'payload must be an object',
    );

    t.throws(
        () => validateEvent(omit(validEvent, 'metadata')),
        /"metadata" is required/,
        'metadata required',
    );

    t.throws(
        () => validateEvent({ ...validEvent, metadata: 10 }),
        '"metadata" must be of type object',
        'metadata must be an object',
    );

    t.throws(
        () => validateEvent(omit(validEvent, 'sequenceNumber')),
        /"sequenceNumber" is required/,
        'sequenceNumber required',
    );

    t.throws(
        () => validateEvent({ ...validEvent, sequenceNumber: 'asdf' }),
        /"sequenceNumber" must be a number/,
        'sequenceNumber must be a number',
    );

    t.throws(
        () => validateEvent({ ...validEvent, sequenceNumber: 0 }),
        /"sequenceNumber" must be greater than 0/,
        'sequenceNumber must be positive',
    );
});

test('validateAggregate()', t => {
    const validAggregate = {
        idField: 'someId',
        projection: {
            initialState: noop,
            applyEvent: noop,
            validateState: noop,
        },
        commands: {
            create: {
                validateParams: noop,
                createEvent: noop,
                isCreateCommand: true,
            },
            setName: {
                validateParams: noop,
                createEvent: noop,
                retries: 5,
            },
        },
    };

    t.notThrows(
        () => validateAggregate(validAggregate, 'testAggregate'),
        'valid aggregate passes',
    );

    t.throws(
        () =>
            validateAggregate(omit(validAggregate, 'idField'), 'testAggregate'),
        /"idField" is required/,
        'idField required',
    );

    t.throws(
        () =>
            validateAggregate(
                omit(validAggregate, 'projection'),
                'testAggregate',
            ),
        /"projection" is required/,
        'projection required',
    );

    t.throws(
        () =>
            validateAggregate(
                omit(validAggregate, 'projection.initialState'),
                'testAggregate',
            ),
        /"initialState" is required/,
        'projection > initialState required',
    );

    t.throws(
        () =>
            validateAggregate(
                omit(validAggregate, 'projection.applyEvent'),
                'testAggregate',
            ),
        /"applyEvent" is required/,
        'projection > applyEvent required',
    );

    t.throws(
        () =>
            validateAggregate(
                omit(validAggregate, 'projection.validateState'),
                'testAggregate',
            ),
        /"validateState" is required/,
        'projection > validateState required',
    );

    t.throws(
        () =>
            validateAggregate(
                omit(validAggregate, 'commands'),
                'testAggregate',
            ),
        /"commands" is required/,
        'commands required',
    );

    t.throws(
        () =>
            validateAggregate(
                omit(validAggregate, 'commands.setName.validateParams'),
                'testAggregate',
            ),
        /"validateParams" is required/,
        'command > validateParams required',
    );

    t.throws(
        () =>
            validateAggregate(
                omit(validAggregate, 'commands.setName.createEvent'),
                'testAggregate',
            ),
        /"createEvent" is required/,
        'command > createEvent required',
    );
});

test('validateEventRepository()', t => {
    const validRepo = {
        getEvents: noop,
        writeEvent: noop,
    };

    {
        const { error } = validateEventRepository(validRepo);
        t.is(error, undefined, 'no error for valid repo');
    }

    {
        const { error } = validateEventRepository(omit(validRepo, 'getEvents'));
        t.snapshot(error, 'error when getEvents omitted');
    }

    {
        const { error } = validateEventRepository(
            omit(validRepo, 'writeEvent'),
        );
        t.snapshot(error, 'error when writeEvent omitted');
    }
});

test('validateNotificationHandler()', t => {
    const validHandler = {
        invalidEventsFound: noop,
        eventWritten: noop,
    };

    {
        const { error } = validateNotificationHandler(validHandler);
        t.is(error, undefined, 'no error for valid handler');
    }

    {
        const { error } = validateNotificationHandler(
            omit(validHandler, 'invalidEventsFound'),
        );
        t.snapshot(error, 'error when invalidEventsFound omitted');
    }

    {
        const { error } = validateNotificationHandler(
            omit(validHandler, 'eventWritten'),
        );
        t.snapshot(error, 'error when eventWritten omitted');
    }
});

test('validateSnapshotRepository()', t => {
    const validRepo = {
        getSnapshot: noop,
        writeSnapshot: noop,
    };

    {
        const { error } = validateSnapshotRepository(validRepo);
        t.is(error, undefined, 'no error for valid repo');
    }

    {
        const { error } = validateSnapshotRepository(
            omit(validRepo, 'getSnapshot'),
        );
        t.snapshot(error, 'error when getSnapshot omitted');
    }

    {
        const { error } = validateSnapshotRepository(
            omit(validRepo, 'writeSnapshot'),
        );
        t.snapshot(error, 'error when writeSnapshot omitted');
    }
});

test('AggregateNotFoundError', t => {
    const err = new AggregateNotFoundError('book', 'AjLS_AMKa');
    t.true(err instanceof Error);
    t.snapshot(err, 'aggregate "book", id "AjLS_AMKa"');
});

test('DuplicateAggregateError', t => {
    const err = new DuplicateAggregateError('book', 'AjLS_AMKa');
    t.true(err instanceof Error);
    t.snapshot(err, 'aggregate "book", id "AjLS_AMKa"');
});

test('EventPayloadError', t => {
    const err = new EventPayloadError('BOOK_NAME_SET', 'name');
    t.true(err instanceof Error);
    t.snapshot(err, 'event "BOOK_NAME_SET", key "name"');
});

test('InvalidCommandParamsError', t => {
    const err = new InvalidCommandParamsError(
        'name too short',
        'book',
        'setName',
    );
    t.true(err instanceof Error);
    t.snapshot(
        err,
        'message "name too short", aggregate "book", command "setName',
    );
});

test('InvariantViolatedError', t => {
    const err = new InvariantViolatedError(
        'book',
        'AjLS_AMKa',
        {},
        'book cannot have zero length',
    );
    t.true(err instanceof Error);
    t.snapshot(
        err,
        'agreggate "book", id "AjLS_AMKa", empty state, msg "book cannot have zero length"',
    );
});

test('MaxCommandAttemptsError', t => {
    const err = new MaxCommandAttemptsError('book', 'create', 5);
    t.true(err instanceof Error);
    t.snapshot(err, 'agreggate "book", command "create", 5 attempts');
});

test('UnauthorizedError', t => {
    const operation = {
        type: 'runCommand',
        commandName: 'setName',
        aggregateName: 'book',
        aggregateId: 'AjLS_AMKa',
    };
    const err = new UnauthorizedError(operation, 'sally');
    t.true(err instanceof Error);
    t.snapshot(
        err,
        'operation runCommand/setName/book/AjLS_AMKa, user "sally"',
    );
});

test('UnknownAggregateError', t => {
    const err = new UnknownAggregateError('frog');
    t.true(err instanceof Error);
    t.snapshot(err, 'aggregate "frog"');
});

test('UnknownCommandError', t => {
    const err = new UnknownCommandError('book', 'setZipCode');
    t.true(err instanceof Error);
    t.snapshot(err, 'aggregate "book", command "setZipCode"');
});

test('UnknownEventTypeError', t => {
    const err = new UnknownEventTypeError('GRAB_SNAKE');
    t.true(err instanceof Error);
    t.snapshot(err, 'event type "GRAB_SNAKE"');
});
