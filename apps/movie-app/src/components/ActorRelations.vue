<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { actorApi } from '../lib/api-client'

interface Props {
  actorId: string
  actorName: string
}

const props = defineProps<Props>()

interface ActorRelation {
  partnerId: string
  partnerName: string
  partnerSlug: string
  partnerAvatar?: string
  collaborationCount: number
  sharedMovies: Array<{
    movieId: string
    movieCode: string
    movieTitle: string
  }>
}

const loading = ref(true)
const error = ref('')
const relations = ref<ActorRelation[]>([])
const showAll = ref(false)

const displayedRelations = computed(() => {
  return showAll.value ? relations.value : relations.value.slice(0, 6)
})

async function loadRelations() {
  loading.value = true
  error.value = ''
  try {
    const response = await actorApi.getActorRelations(props.actorId, {
      minCollaborations: 2,
      limit: 20,
    })

    if (response.success && response.data) {
      relations.value = response.data.relations
    }
  }
  catch (err) {
    console.error('Failed to load actor relations:', err)
    error.value = '加载合作关系失败'
  }
  finally {
    loading.value = false
  }
}

onMounted(() => {
  loadRelations()
})
</script>

<template>
  <div class="actor-relations">
    <h2 class="section-title">
      合作关系
    </h2>

    <div v-if="loading" class="loading">
      加载中...
    </div>

    <div v-else-if="error" class="error">
      {{ error }}
    </div>

    <div v-else-if="relations.length === 0" class="empty">
      暂无合作关系数据
    </div>

    <div v-else>
      <div class="relations-grid">
        <RouterLink
          v-for="rel in displayedRelations"
          :key="rel.partnerId"
          :to="`/actors/${rel.partnerSlug}`"
          class="relation-card"
        >
          <div class="partner-avatar">
            <img
              v-if="rel.partnerAvatar"
              :src="rel.partnerAvatar"
              :alt="rel.partnerName"
            >
            <div v-else class="avatar-placeholder">
              {{ rel.partnerName[0] }}
            </div>
          </div>
          <div class="partner-info">
            <h3 class="partner-name">
              {{ rel.partnerName }}
            </h3>
            <p class="collaboration-count">
              合作 {{ rel.collaborationCount }} 次
            </p>
          </div>
        </RouterLink>
      </div>

      <button
        v-if="relations.length > 6"
        class="show-more-btn"
        @click="showAll = !showAll"
      >
        {{ showAll ? '收起' : `查看全部 (${relations.length})` }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.actor-relations {
  margin-top: 3rem;
}

.section-title {
  font-size: 1.5rem;
  font-weight: 600;
  margin-bottom: 1.5rem;
  color: #fff;
}

.loading,
.error,
.empty {
  text-align: center;
  padding: 2rem;
  color: #9ca3af;
}

.error {
  color: #ef4444;
}

.relations-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 1rem;
  margin-bottom: 1rem;
}

.relation-card {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
  background: #1f2937;
  border: 1px solid #374151;
  border-radius: 8px;
  text-decoration: none;
  color: inherit;
  transition: transform 0.2s, box-shadow 0.2s, border-color 0.2s;
}

.relation-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  border-color: #3b82f6;
}

.partner-avatar {
  width: 60px;
  height: 60px;
  border-radius: 50%;
  overflow: hidden;
  background: #374151;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.partner-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.avatar-placeholder {
  font-size: 1.5rem;
  font-weight: bold;
  color: #9ca3af;
}

.partner-info {
  flex: 1;
  min-width: 0;
}

.partner-name {
  font-size: 1rem;
  font-weight: 600;
  margin-bottom: 0.25rem;
  color: #fff;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.collaboration-count {
  font-size: 0.875rem;
  color: #9ca3af;
}

.show-more-btn {
  width: 100%;
  padding: 0.75rem;
  background: #1f2937;
  border: 1px solid #374151;
  border-radius: 8px;
  color: #3b82f6;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s, border-color 0.2s;
}

.show-more-btn:hover {
  background: #374151;
  border-color: #3b82f6;
}

@media (max-width: 768px) {
  .relations-grid {
    grid-template-columns: 1fr;
  }
}
</style>
