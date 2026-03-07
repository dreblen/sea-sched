import { createRouter, createWebHistory } from 'vue-router'

import Home from '@/components/Home/Index.vue'
import Setup from '@/components/Setup/Index.vue'
import Parameters from '@/components/Parameters/Index.vue'
import Results from '@/components/Results/Index.vue'
import View from '@/components/View/Index.vue'

const router = createRouter({
    history: createWebHistory(import.meta.env.BASE_URL),
    routes: [
        { path: '/', component: Home },
        { path: '/setup', component: Setup },
        { path: '/parameters', component: Parameters },
        { path: '/results', component: Results },
        { path: '/view/:base64?', component: View },
    ],
})

// Make sure a query string specified on one route is applied to the next route
router.beforeEach((to, from) => {
    if (Object.keys(from.query).length > 0 && Object.keys(to.query).length === 0) {
        return {
            ...to,
            query: { ...from.query },
        }
    } else {
        return true
    }
})

export default router
