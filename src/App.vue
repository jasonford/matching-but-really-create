<template>
  <div class="main-wrapper">
    
    <Modal
      v-if="previewContent"
      @close="store.dispatch('previewContent', null)"
    >
      <template v-slot:body>
        <Suspense>
          <PlayOrCustomizeByTypeSwitcher
            :key="`preview-${previewContent}`"
            :id="previewContent"
            mode="player"
            @close="store.dispatch('previewContent', null)"
          />
        </Suspense>
      </template>
      <template v-slot:footer><div></div></template>
    </Modal>

    <div class="left-col">
      <div class="logo-line" @click="data.active = null">
        <div class="logo-and-name">
          <img id="logo" src="./assets/pila.png">
          <h2>Pila {{ t('create') }}</h2>
        </div>
        <div class="button-area">
          <v-btn
            @click="addNew()"
            icon="fa-solid fa-plus"
            size="small"
            class="mr-2 "
          />
          <v-btn
            @click="copyExisting"
            icon="fa-solid fa-copy"
            size="small"
          />
        </div>
      </div>
      <Suspense>
        <ContentBar v-if="data.content"
          :items="data.content"
          :active="data.active"
          @removeItem="removeItem"
          @active="data.active = $event"
        />
      </Suspense>
      <div v-if="!data.content">Loading...</div>

    </div>
    <div class="right-col">
      <div class="header">
        <v-btn
          @click="logout"
          size="small"
          append-icon="fa-solid fa-sign-out-alt"
        >
          <span>{{ t('logout') }}</span>
        </v-btn>
        <v-avatar
          class="mx-2"
          size="small"
          :image="data.userAvatarPath"
        />
        <v-select
          class="pa-2"
          density="compact"
          hide-details
          bg-color="white"
          :items="['en','th']"
          :model-value="store.getters.language()"
          @update:model-value="store.dispatch('language', $event)"
          style="max-width: 100px;"
        />
      </div>
      <div class="right-inner" v-if="data.active">
        <Suspense>
          <PlayOrCustomizeByTypeSwitcher
            :key="`customize-${data.active}`"
            :id="data.active"
            mode="customizer"
          />
        </Suspense>
      </div>
      <div class="right-inner" v-else>
        <Welcome @addNew="addNew" />
      </div>
    </div>

  </div>
</template>

<script setup>
  import { reactive, computed } from 'vue'
  import Modal from './components/Modal.vue'
  import ContentBar from './components/ContentBar.vue'
  import Welcome from './components/Welcome.vue'
  import PlayOrCustomizeByTypeSwitcher from './components/PlayOrCustomizeByTypeSwitcher.vue'
  import { chooseTypeSwal, copyItemSwal, areYouSureSwal } from './helpers/swallows.js'
  import questionTypes from './helpers/questionTypes.js'
  import { useStore } from 'vuex'
  const store = useStore()
  const t = slug => store.getters.t(slug)


  const copy = x => JSON.parse(JSON.stringify(x))
  const MY_CONTENT_TAG = '8e6cb070-ec84-11ee-825b-edbc0a87ecf3'

  const userImagePath = reactive(null)
  const data = reactive({
    content: [],
    active: null,
    tags: null,
    userAvatarPath: null
  })

  async function fetchMyContentAndUserInfo() {
    const { auth: { user, info: { picture } } } = await Agent.environment()
    data.userAvatarPath = picture
    data.content = (await Agent.query(
      'taggings-for-tag',
      [ user, MY_CONTENT_TAG ],
      'tags.knowlearning.systems'
    )).map(obj => obj.target)
  }
  fetchMyContentAndUserInfo()

  Agent
    .state('tags')
    .then(state => {
      data.tags = state
      if (!data.tags[MY_CONTENT_TAG]) {
        data.tags[MY_CONTENT_TAG] = { value: true }
      }
    })
    
  const previewContent = computed(() => store.getters.previewContent())

  async function addNew(active_type) {
    if (!active_type) {
      const { value, isConfirmed } = await chooseTypeSwal(t)
      if (isConfirmed) active_type = value
    }
    if (!active_type) return
    // get demo question for active language
    const lang = store.getters.language()
    await createContent(
      active_type,
      questionTypes[active_type].newItemGenerator({})
    )
  }
  
  async function copyExisting() {
    const { value: idToCopy } = await copyItemSwal(t) // validates id and type 
    if (!idToCopy) return
    const { active_type } = await Agent.metadata(idToCopy)
    const stateToCopy = await Agent.state(idToCopy)
    await createContent(active_type, copy(stateToCopy))
  }
  async function createContent(active_type, active) {
    const newItemId = await Agent.create({ active_type, active })
    data.tags[MY_CONTENT_TAG][newItemId] = { value: true } // tag as 'my-content'
    data.content.push(newItemId) // optimistic update locally loaded
    await Agent.synced()
    data.active = newItemId // make new item active
  }

  async function removeItem(id) {
    const { isConfirmed } = await areYouSureSwal(t)
    if (!isConfirmed) return

    if (data.active === id) data.active = null
    data.content = data.content.filter(content => content !== id)
    data.tags[MY_CONTENT_TAG][id] = { value: null }
  }
  function logout() {
    Agent.logout()
  }
</script>

<style scoped>
.main-wrapper {
  width: 100%;
  height: 100vh;
  display: grid;
  grid-template-columns: 330px 1fr;
}
.left-col, .right-col {
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: scroll;
}
.left-col {
  padding: 0 12px;
  text-align: left;
  border-right: 1px solid slategray;
}
.left-col .logo-line {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 4px 0;
  cursor: pointer;
}
.left-col .logo-and-name {
  display: flex;
  align-items: center;
}
.left-col .logo-line h2 {
  margin: 0 0 0 12px;
}
.left-col .logo-line #logo {
  width: 30px;
  height: 30px;
}
.left-col .logo-line button {
  font-size: 0.8rem;
}
.left-col .logo-line button:hover {
  background: #eee;
}
.right-col {
  width: 100%;
  flex-grow: 1;
}
.right-col .header {
  justify-content: flex-end;
  align-items: center;
  height: 52px;
  display: flex;
  background: rgb(43,46,211);
}
.right-col .right-inner {
  height: 100%;
}
</style>