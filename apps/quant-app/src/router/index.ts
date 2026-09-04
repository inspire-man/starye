import type { QuantView } from '../lib/quant-view'
import { defineComponent } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import { quantViews } from '../lib/quant-view'

const QuantRoutePlaceholder = defineComponent({
  name: 'QuantRoutePlaceholder',
  setup: () => () => null,
})

// The app already exposes flat #view links from Gateway pages. Memory history lets
// Vue Router own navigation state without changing that public URL contract.
export const quantRouter = createRouter({
  history: createMemoryHistory('/quant/'),
  routes: [
    {
      path: '/',
      redirect: { name: 'overview' },
    },
    ...quantViews.map(view => ({
      path: `/${view}`,
      name: view,
      component: QuantRoutePlaceholder,
    })),
  ],
})

export function quantViewFromRouteName(name: unknown): QuantView {
  return quantViews.includes(name as QuantView) ? name as QuantView : 'overview'
}

export default quantRouter
