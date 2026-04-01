// Tenant isolation utilities for SaaS Builder pattern
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(client);

const TABLE_NAME = process.env.DYNAMODB_TABLE || 'saas-app-data';

/**
 * Multi-tenant data access patterns
 * All keys are prefixed with tenantId for isolation
 */

export class TenantDataAccess {
  constructor(tenantId) {
    if (!tenantId) {
      throw new Error('Tenant ID is required for all operations');
    }
    this.tenantId = tenantId;
  }

  // Create a tenant-scoped primary key
  createKey(entityType, entityId) {
    return `${this.tenantId}#${entityType}#${entityId}`;
  }

  // Get a single item by tenant and entity
  async getItem(entityType, entityId) {
    const params = {
      TableName: TABLE_NAME,
      Key: {
        pk: this.createKey(entityType, entityId),
        sk: 'metadata'
      }
    };

    const result = await docClient.send(new GetCommand(params));
    return result.Item;
  }

  // Put an item with tenant isolation
  async putItem(entityType, entityId, data) {
    const params = {
      TableName: TABLE_NAME,
      Item: {
        pk: this.createKey(entityType, entityId),
        sk: 'metadata',
        tenantId: this.tenantId,
        entityType,
        entityId,
        ...data,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    };

    await docClient.send(new PutCommand(params));
    return params.Item;
  }

  // Query all items of a type for this tenant
  async queryByType(entityType) {
    const params = {
      TableName: TABLE_NAME,
      KeyConditionExpression: 'pk = :pk',
      ExpressionAttributeValues: {
        ':pk': `${this.tenantId}#${entityType}`
      }
    };

    const result = await docClient.send(new QueryCommand(params));
    return result.Items || [];
  }
}

/**
 * Extract tenant context from JWT token (normally done by Lambda authorizer)
 * For this example, we'll simulate it with a simple middleware
 */
export function extractTenantContext(req, res, next) {
  // In production, this would be handled by AWS Lambda authorizer
  // The authorizer validates JWT and injects tenant info into request context
  
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ 
      error: { code: 'UNAUTHORIZED', message: 'Missing or invalid authorization header' }
    });
  }

  try {
    // Simulate JWT parsing (in real app, use proper JWT library)
    const token = authHeader.split(' ')[1];
    
    // SECURITY: This only decodes the payload without verifying the signature.
    // This route (/api/v1/users) is a legacy SaaS scaffold and is NOT used by the
    // main application. In production, replace this with proper JWT verification
    // (e.g. jsonwebtoken.verify()) before enabling this route.
    const parts = token.split('.');
    if (parts.length !== 3) {
      return res.status(401).json({
        error: { code: 'INVALID_TOKEN', message: 'Malformed JWT token' }
      });
    }
    const decoded = JSON.parse(Buffer.from(parts[1], 'base64').toString());
    
    if (!decoded.tenantId) {
      return res.status(403).json({
        error: { code: 'FORBIDDEN', message: 'No tenant context in token' }
      });
    }

    // Inject tenant context (like Lambda authorizer would do)
    req.tenantContext = {
      tenantId: decoded.tenantId,
      userId: decoded.userId,
      roles: decoded.roles || ['user']
    };

    next();
  } catch (error) {
    return res.status(401).json({
      error: { code: 'INVALID_TOKEN', message: 'Invalid JWT token' }
    });
  }
}

/**
 * Role-based access control middleware
 */
export function requireRole(requiredRole) {
  return (req, res, next) => {
    const { roles } = req.tenantContext;
    
    if (!roles.includes(requiredRole)) {
      return res.status(403).json({
        error: { code: 'INSUFFICIENT_PERMISSIONS', message: `Role '${requiredRole}' required` }
      });
    }
    
    next();
  };
}