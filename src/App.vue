<script setup>
import { ref } from "vue";

import { onMounted } from "vue";
import { useMap } from "./geo";
import MapControls from "./components/MapControls.vue";

const mapInitialized = ref(false);

onMounted(() => {
  useMap("map-container");
  mapInitialized.value = true;
});
</script>

<template>
  <div class="h-full w-full relative">
    <div id="map-container" class="map w-full h-full"></div>
    <MapControls v-if="mapInitialized" />
  </div>
</template>
