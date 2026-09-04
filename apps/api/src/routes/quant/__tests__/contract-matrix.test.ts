import type { QuantEndpointContract } from '@starye/quant-contracts'
import { quantEndpointContractKey, quantEndpointContracts } from '@starye/quant-contracts'
import { generateSpecs } from 'hono-openapi'
import { describe, expect, it } from 'vitest'
import { quantRoutes } from '../index'

const HTTP_METHODS = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE'])

function normalizedRoutePath(path: string): string {
  return path.replace(/:([^/]+)/gu, '{$1}')
}

function runtimeRouteKeys(): Set<string> {
  return new Set(quantRoutes.routes
    .filter(route => HTTP_METHODS.has(route.method))
    .map(route => `${route.method} ${route.path}`))
}

function contractKey(contract: QuantEndpointContract): string {
  return quantEndpointContractKey(contract)
}

function operationFor(spec: Awaited<ReturnType<typeof generateSpecs>>, contract: QuantEndpointContract): Record<string, any> {
  const path = spec.paths[normalizedRoutePath(contract.path)]
  const operation = path?.[contract.method.toLowerCase() as keyof typeof path]
  return operation as Record<string, any>
}

describe('quant endpoint contract matrix', () => {
  it('covers every mounted Quant operation exactly once', () => {
    const manifestKeys = quantEndpointContracts.map(contractKey)
    const mountedKeys = [...runtimeRouteKeys()]

    expect(quantEndpointContracts).toHaveLength(47)
    expect(new Set(manifestKeys).size).toBe(manifestKeys.length)
    expect(new Set(mountedKeys).size).toBe(47)
    expect(mountedKeys.sort()).toEqual(manifestKeys.sort())
  })

  it('keeps request validators, response schemas, statuses and errors visible in OpenAPI', async () => {
    const spec = await generateSpecs(quantRoutes, {
      documentation: {
        openapi: '3.0.0',
        info: { title: 'Starye Quant', version: '1.0.0' },
      },
    })
    const operations = quantEndpointContracts.map(contract => operationFor(spec, contract))

    expect(operations).toHaveLength(47)
    for (const [index, contract] of quantEndpointContracts.entries()) {
      const operation = operations[index]
      expect(operation, contractKey(contract)).toBeDefined()
      expect(operation.operationId, contractKey(contract)).toBe(contract.operationId)

      if (contract.input.body)
        expect(operation.requestBody, `${contractKey(contract)} request body`).toBeDefined()
      if (contract.input.params || contract.input.query)
        expect(operation.parameters?.length, `${contractKey(contract)} parameters`).toBeGreaterThan(0)

      const responses = operation.responses as Record<string, any>
      const success = responses[String(contract.success.status)]
      expect(success, `${contractKey(contract)} success status`).toBeDefined()
      expect(success.content?.[contract.success.contentType], `${contractKey(contract)} success content`).toBeDefined()
      for (const error of contract.errors)
        expect(responses[String(error.status)], `${contractKey(contract)} error status ${error.status}`).toBeDefined()
    }
  })
})
