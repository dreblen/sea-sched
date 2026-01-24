 <script setup lang="ts">
import { onBeforeUnmount } from 'vue'

const props = defineProps<{
    highlightClassName: string
    highlightColor: string
}>()

function onEnterOrLeave(type: 'enter'|'leave') {
    const matchingTags = document.getElementsByClassName(props.highlightClassName)
    for (const tag of matchingTags) {
        let targetValue = (type === 'enter') ? props.highlightColor : '';
        (tag as HTMLElement).style.backgroundColor = targetValue
    }
}

onBeforeUnmount(() => {
    // If our component is going away, make sure we don't leave behind any
    // highlights that won't be able to trigger a leave event on their own
    onEnterOrLeave('leave')
})
 </script>

 <template>
    <span
        :class="highlightClassName"
        @mouseenter="onEnterOrLeave('enter')"
        @mouseleave="onEnterOrLeave('leave')"
    >
        <slot></slot>
    </span>
 </template>
