<script setup lang="ts">
import type { Data, Options } from 'vis-network/standalone'
import { Network } from 'vis-network/standalone'
import { onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

interface ActorRelation {
  partnerId: string
  partnerName: string
  partnerSlug: string
  partnerAvatar: string | null
  collaborationCount: number
  sharedMovieIds: string[]
}

interface Props {
  actorId: string
  actorName: string
}

const props = defineProps<Props>()
const router = useRouter()

const loading = ref(false)
const error = ref('')
const relations = ref<ActorRelation[]>([])
const minCollaborations = ref(3)
const limit = ref(20)
const networkContainer = ref<HTMLElement | null>(null)
let network: Network | null = null

async function loadRelations() {
  loading.value = true
  error.value = ''

  try {
    const response = await fetch(
      `/api/actors/${props.actorId}/relations?minCollaborations=${minCollaborations.value}&limit=${limit.value}`,
    )

    if (!response.ok) {
      throw new Error(`API 错误: ${response.status}`)
    }

    const result = await response.json() as {
      success: boolean
      data: {
        actorId: string
        relations: ActorRelation[]
        meta: { totalPartners: number, minCollaborations: number }
      }
    }

    relations.value = result.data.relations
    renderGraph()
  }
  catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    error.value = `加载关系图谱失败: ${message}`
  }
  finally {
    loading.value = false
  }
}

function renderGraph() {
  if (!networkContainer.value || relations.value.length === 0)
    return

  // 构建节点数据
  const nodes = [
    {
      id: props.actorId,
      label: props.actorName,
      color: {
        background: '#ef4444',
        border: '#dc2626',
      },
      font: { color: '#ffffff', size: 16, bold: 'bold' as const },
      size: 30,
    },
    ...relations.value.map(rel => ({
      id: rel.partnerId,
      label: rel.partnerName,
      color: {
        background: '#3b82f6',
        border: '#2563eb',
      },
      font: { color: '#ffffff', size: 14 },
      size: 20 + Math.min(rel.collaborationCount * 2, 20),
      title: `${rel.partnerName}\n合作 ${rel.collaborationCount} 次`,
    })),
  ]

  // 构建边数据
  const edges = relations.value.map(rel => ({
    from: props.actorId,
    to: rel.partnerId,
    width: 1 + Math.min(rel.collaborationCount / 2, 10),
    label: `${rel.collaborationCount}`,
    font: { size: 12, align: 'middle' as const },
    color: { color: '#94a3b8', highlight: '#475569' },
  }))

  const data: Data = { nodes, edges }

  const options: Options = {
    nodes: {
      shape: 'dot',
      borderWidth: 2,
      shadow: true,
    },
    edges: {
      smooth: {
        enabled: true,
        type: 'continuous',
        roundness: 0.5,
      },
      arrows: {
        to: { enabled: false },
      },
    },
    physics: {
      enabled: true,
      stabilization: {
        iterations: 200,
      },
      barnesHut: {
        gravitationalConstant: -2000,
        springLength: 150,
        springConstant: 0.04,
      },
    },
    interaction: {
      hover: true,
      tooltipDelay: 100,
    },
  }

  // 销毁旧实例
  if (network) {
    network.destroy()
  }

  // 创建新实例
  network = new Network(networkContainer.value, data, options)

  // 点击节点跳转
  network.on('click', (params) => {
    if (params.nodes.length > 0) {
      const nodeId = params.nodes[0] as string

      // 跳过中心节点（当前女优）
      if (nodeId === props.actorId)
        return

      const relation = relations.value.find(r => r.partnerId === nodeId)
      if (relation) {
        router.push(`/actors/${relation.partnerSlug}`)
      }
    }
  })
}

onMounted(() => {
  loadRelations()
})

watch(() => props.actorId, () => {
  loadRelations()
})
</script>

<template>
  <div class="actor-relation-graph">
    <div v-if="loading" class="loading-state">
      <div class="spinner" />
      <p>正在加载关系图谱...</p>
    </div>

    <div v-else-if="error" class="error-state">
      <p>{{ error }}</p>
      <button class="retry-btn" @click="loadRelations">
        重试
      </button>
    </div>

    <div v-else-if="relations.length === 0" class="empty-state">
      <p>暂无合作关系数据</p>
      <p class="hint">
        需要至少 {{ minCollaborations }} 次合作才会显示
      </p>
    </div>

    <div v-else class="graph-container">
      <div class="graph-header">
        <h3>合作关系图谱</h3>
        <div class="graph-controls">
          <label>
            最小合作次数：
            <select v-model.number="minCollaborations" @change="loadRelations">
              <option :value="1">1 次</option>
              <option :value="3">3 次</option>
              <option :value="5">5 次</option>
              <option :value="10">10 次</option>
            </select>
          </label>
          <label>
            显示数量：
            <select v-model.number="limit" @change="loadRelations">
              <option :value="10">10 个</option>
              <option :value="20">20 个</option>
              <option :value="50">50 个</option>
            </select>
          </label>
        </div>
      </div>

      <div ref="networkContainer" class="network-canvas" />

      <div class="graph-legend">
        <div class="legend-item">
          <span class="node-indicator central" />
          <span>当前女优</span>
        </div>
        <div class="legend-item">
          <span class="node-indicator partner" />
          <span>合作伙伴</span>
        </div>
        <div class="legend-item">
          <span class="edge-indicator" />
          <span>合作关系（粗细表示频率）</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.actor-relation-graph {
  width: 100%;
  min-height: 500px;
  background: #ffffff;
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.loading-state,
.error-state,
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 400px;
  color: #6b7280;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 4px solid #e5e7eb;
  border-top-color: #3b82f6;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.error-state {
  color: #ef4444;
}

.retry-btn {
  margin-top: 16px;
  padding: 8px 16px;
  background: #3b82f6;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
}

.retry-btn:hover {
  background: #2563eb;
}

.empty-state .hint {
  margin-top: 8px;
  font-size: 14px;
  color: #9ca3af;
}

.graph-container {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.graph-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-bottom: 16px;
  border-bottom: 1px solid #e5e7eb;
}

.graph-header h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: #111827;
}

.graph-controls {
  display: flex;
  gap: 16px;
}

.graph-controls label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: #4b5563;
}

.graph-controls select {
  padding: 4px 8px;
  border: 1px solid #d1d5db;
  border-radius: 4px;
  font-size: 14px;
  cursor: pointer;
}

.graph-controls select:hover {
  border-color: #9ca3af;
}

.network-canvas {
  width: 100%;
  height: 500px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #fafafa;
}

.graph-legend {
  display: flex;
  gap: 24px;
  padding: 12px;
  background: #f9fafb;
  border-radius: 6px;
  font-size: 13px;
  color: #6b7280;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 8px;
}

.node-indicator {
  display: inline-block;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  border: 2px solid;
}

.node-indicator.central {
  background: #ef4444;
  border-color: #dc2626;
}

.node-indicator.partner {
  background: #3b82f6;
  border-color: #2563eb;
}

.edge-indicator {
  display: inline-block;
  width: 30px;
  height: 3px;
  background: #94a3b8;
  border-radius: 2px;
}
</style>
