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

export default router
