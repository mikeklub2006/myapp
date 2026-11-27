const Ajv = require('ajv');

const schema = {
  type: 'object',
  required: ['name', 'email', 'group_name', 'course', 'grade'],
  properties: {
    name: { type: 'string', minLength: 2, maxLength: 100 },
    email: { type: 'string', pattern: '^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$' },
    group_name: { type: 'string', pattern: '^\\d{3}$' },
    course: { type: 'integer', minimum: 1, maximum: 4 },
    grade: { type: 'number', minimum: 2, maximum: 5 }
  },
  additionalProperties: false
};

const ajv = new Ajv({ allErrors: true });
const validateCreate = ajv.compile(schema);
const validateUpdate = ajv.compile({ ...schema, required: [], minProperties: 1 });

class ValidationError extends Error {
  constructor(details) {
    super('Validation failed');
    this.status = 400;
    this.details = details;
  }
}

function formatErrors(errors) {
  return errors.map((e) => ({
    field: e.instancePath.replace('/', '') || e.params.missingProperty || e.params.additionalProperty || 'body',
    message: e.message
  }));
}

function validate(data, partial = false) {
  const check = partial ? validateUpdate : validateCreate;
  if (!check(data)) throw new ValidationError(formatErrors(check.errors));
  return data;
}

// та же схема для валидатора коллекции, в mongo вместо type используется bsonType
function mongoSchema() {
  const properties = {};
  for (const [key, value] of Object.entries(schema.properties)) {
    const { type, ...rest } = value;
    properties[key] = { bsonType: type === 'integer' ? 'int' : type, ...rest };
  }
  properties.created_at = { bsonType: 'date' };
  properties.updated_at = { bsonType: 'date' };
  return { bsonType: 'object', required: [...schema.required, 'created_at'], properties };
}

module.exports = { schema, validate, mongoSchema, ValidationError };
