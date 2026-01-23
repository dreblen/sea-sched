 <script setup lang="ts">
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
