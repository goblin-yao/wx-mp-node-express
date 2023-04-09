<template>
  <div>
    <div class="tab-header">
      <div
        v-for="(tab, index) in tabs"
        :key="index"
        :class="{ active: activeTab === index }"
        @click="activeTab = index"
      >
        {{ tab.title }}
      </div>
    </div>
    <div class="tab-content">
      <div v-for="(tab, index) in tabs" :key="index" v-show="activeTab === index">
        {{ tab.content }}
      </div>
    </div>
  </div>
</template>

<script lang="ts">
export default {
  components: {},
  data() {
    return {
      activeTab: 0,
      tabs: [
        { title: 'Tab 1', content: 'This is tab 1 content.' },
        { title: 'Tab 2', content: 'This is tab 2 content.' },
        { title: 'Tab 3', content: 'This is tab 3 content.' }
      ]
    }
  }
}
</script>

<style>
.tab-header {
  display: flex;
  justify-content: space-between;
  border-bottom: 1px solid #ccc;
}

.tab-header div {
  padding: 10px;
  cursor: pointer;
}

.tab-header .active {
  background-color: #f0f0f0;
  font-weight: bold;
}

.tab-content div {
  padding: 10px;
}
</style>
