<script setup>
  import {
    computed
  } from 'vue';
  import AdminDashboardView from './AdminDashboardView.vue';
  import PublicMonitorView from './PublicMonitorView.vue';

  const props = defineProps({
    mode: {
      type: String,
      required: true
    },
    category: {
      type: String,
      required: true
    }
  });
  const workflow = `${props.category}JanJun`;
  const periodLabel = 'Januari-Juni & Juli-Desember';
  const categoryLabel = computed(() => props.category === 'berjalan' ? 'Bulan Berjalan' : 'Ajuan');
  const title = computed(() =>
    props.mode === 'admin' ? `Panel Admin ${categoryLabel.value}` : `Pantau Berkas ${categoryLabel.value}`
  );
  const DashboardComponent = computed(() =>
    props.mode === 'admin' ? AdminDashboardView : PublicMonitorView
  );
</script>

<template>
  <div>
    <component
      :is="DashboardComponent"
      :key="mode"
      :workflow="workflow"
      :title="title"
      :period="periodLabel"
      :combined="true"
    />
  </div>
</template>
