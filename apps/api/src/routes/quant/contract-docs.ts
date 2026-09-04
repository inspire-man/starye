import type { QuantEndpointContract, QuantEndpointId } from '@starye/quant-contracts'
import type { DescribeRouteOptions, ResponsesWithResolver } from 'hono-openapi'
import { quantEndpointContracts } from '@starye/quant-contracts'
import { describeRoute, resolver } from 'hono-openapi'
import * as quantSchemas from '../../schemas/quant-responses'
import { ErrorResponseSchema } from '../../schemas/responses'

const responseSchemas: Record<string, Parameters<typeof resolver>[0]> = {
  QuantAiCandidateBriefingQuestionResponseSchema: quantSchemas.QuantAiCandidateBriefingQuestionResponseSchema,
  QuantAiCandidateBriefingResponseSchema: quantSchemas.QuantAiCandidateBriefingResponseSchema,
  QuantAiCandidateBriefingSessionDeleteResponseSchema: quantSchemas.QuantAiCandidateBriefingSessionDeleteResponseSchema,
  QuantAiCandidateBriefingSessionListResponseSchema: quantSchemas.QuantAiCandidateBriefingSessionListResponseSchema,
  QuantAiCandidateBriefingSessionResponseSchema: quantSchemas.QuantAiCandidateBriefingSessionResponseSchema,
  QuantAiConfigDeleteResponseSchema: quantSchemas.QuantAiConfigDeleteResponseSchema,
  QuantAiConfigResponseSchema: quantSchemas.QuantAiConfigResponseSchema,
  QuantAiConnectionTestResponseSchema: quantSchemas.QuantAiConnectionTestResponseSchema,
  QuantAiRunAuditsResponseSchema: quantSchemas.QuantAiRunAuditsResponseSchema,
  QuantCandidateSnapshotResponseSchema: quantSchemas.QuantCandidateSnapshotResponseSchema,
  QuantCapabilitiesResponseSchema: quantSchemas.QuantCapabilitiesResponseSchema,
  QuantDailyBarsResponseSchema: quantSchemas.QuantDailyBarsResponseSchema,
  QuantDecisionAssistantListResponseSchema: quantSchemas.QuantDecisionAssistantListResponseSchema,
  QuantDecisionAssistantResponseSchema: quantSchemas.QuantDecisionAssistantResponseSchema,
  QuantDecisionRecordResponseSchema: quantSchemas.QuantDecisionRecordResponseSchema,
  QuantDecisionRecordsResponseSchema: quantSchemas.QuantDecisionRecordsResponseSchema,
  QuantFactorConfigurationResponseSchema: quantSchemas.QuantFactorConfigurationResponseSchema,
  QuantFinancialQualityComparisonResponseSchema: quantSchemas.QuantFinancialQualityComparisonResponseSchema,
  QuantFinancialQualityHistoryResponseSchema: quantSchemas.QuantFinancialQualityHistoryResponseSchema,
  QuantFinancialQualityResponseSchema: quantSchemas.QuantFinancialQualityResponseSchema,
  QuantInvestmentKnowledgeResponseSchema: quantSchemas.QuantInvestmentKnowledgeResponseSchema,
  QuantResearchChangeExplanationResponseSchema: quantSchemas.QuantResearchChangeExplanationResponseSchema,
  QuantResearchComparisonResponseSchema: quantSchemas.QuantResearchComparisonResponseSchema,
  QuantResearchMarkerResponseSchema: quantSchemas.QuantResearchMarkerResponseSchema,
  QuantResearchMarkersResponseSchema: quantSchemas.QuantResearchMarkersResponseSchema,
  QuantResearchQuestionResponseSchema: quantSchemas.QuantResearchQuestionResponseSchema,
  QuantResearchRunResponseSchema: quantSchemas.QuantResearchRunResponseSchema,
  QuantResearchRunsResponseSchema: quantSchemas.QuantResearchRunsResponseSchema,
  QuantResearchSummariesResponseSchema: quantSchemas.QuantResearchSummariesResponseSchema,
  QuantResearchSummaryResponseSchema: quantSchemas.QuantResearchSummaryResponseSchema,
  QuantResearchSummaryStreamEventSchema: quantSchemas.QuantResearchSummaryStreamEventSchema,
  QuantShareholderReturnsResponseSchema: quantSchemas.QuantShareholderReturnsResponseSchema,
  QuantStockBasicResponseSchema: quantSchemas.QuantStockBasicResponseSchema,
  QuantSyncResultResponseSchema: quantSchemas.QuantSyncResultResponseSchema,
  QuantSyncStateResponseSchema: quantSchemas.QuantSyncStateResponseSchema,
  QuantValuationComparisonResponseSchema: quantSchemas.QuantValuationComparisonResponseSchema,
  QuantValuationResponseSchema: quantSchemas.QuantValuationResponseSchema,
  QuantValueSelectionResponseSchema: quantSchemas.QuantValueSelectionResponseSchema,
  QuantWatchlistDeleteResponseSchema: quantSchemas.QuantWatchlistDeleteResponseSchema,
  QuantWatchlistItemResponseSchema: quantSchemas.QuantWatchlistItemResponseSchema,
  QuantWatchlistResponseSchema: quantSchemas.QuantWatchlistResponseSchema,
}

const contractById = new Map<QuantEndpointId, QuantEndpointContract>(quantEndpointContracts.map(contract => [contract.id, contract]))

function responseSchema(contract: QuantEndpointContract) {
  const schema = responseSchemas[contract.success.responseSchema]
  if (!schema)
    throw new Error(`Quant response schema is not registered: ${contract.success.responseSchema}`)
  return resolver(schema)
}

function errorResponses(contract: QuantEndpointContract): NonNullable<DescribeRouteOptions['responses']> {
  return Object.fromEntries(contract.errors.map((error) => {
    const codeText = error.codes.join(', ')
    return [String(error.status), {
      description: `错误：${codeText}`,
      content: {
        'application/json': {
          schema: resolver(ErrorResponseSchema),
        },
      },
    }]
  }))
}

export function quantRouteDocs(id: QuantEndpointId) {
  const contract = contractById.get(id)
  if (!contract)
    throw new Error(`Unknown Quant endpoint contract: ${id}`)

  const successResponse: ResponsesWithResolver[string] = contract.success.contentType === 'text/event-stream'
    ? {
        description: 'SSE 流式响应',
        content: {
          'text/event-stream': {
            schema: responseSchema(contract),
          },
        },
      }
    : {
        description: '成功',
        content: {
          'application/json': {
            schema: responseSchema(contract),
          },
        },
      }

  return describeRoute({
    summary: contract.summary,
    description: `${contract.summary}。认证用户数据按当前会话隔离。`,
    tags: ['Quant'],
    operationId: contract.operationId,
    security: [{ cookieAuth: [] }],
    responses: {
      [String(contract.success.status)]: successResponse,
      ...errorResponses(contract),
    },
  })
}
