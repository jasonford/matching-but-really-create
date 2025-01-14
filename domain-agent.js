  import Agent, { getAgent } from 'npm:@knowlearning/agents/deno.js'

  const XAPI_DOMAIN = 'f74e9cb3-2b53-4c85-9b0c-f1d61b032b3f.localhost:5444'
  // TRANSLATION AGENT STUFF
  // const TRANSLATION_DOMAIN = 'f74e9cb3-2b53-4c85-9b0c-f1d61b032b3f.localhost:5889'
  const TRANSLATION_DOMAIN = 'translations.pilaproject.org'
  const TRANSLATABLE_TARGET_TYPE = 'application/json;type=translatable_target'

  const TranslationAgent = getAgent(TRANSLATION_DOMAIN)
  const xApiAgent = getAgent(XAPI_DOMAIN)

  Agent.on('child', child => {
    child.on('mutate', async ({ id, patch }) => {
      if (await isTranslatableItem(id)) {
        await handleTranslatableItem(id)
      }
      //  TODO: handle if xapi modified in any path
      if (patch[0].path[0] === 'xapi') {
        const origin = id
        const actor = await Agent.metadata(id).then(md => md.owner)
        const state = await Agent.state(id)

        const { verb, object, result, context, authority } = state.xapi
        const active = { origin, actor, verb, object }

        if (result) active.result = result
        if (context) active.context = context
        if (authority) active.authority = authority

        Object.assign(
          await xApiAgent.state(`xapi/${Agent.uuid()}`),
          active
        )
      }
    })
  })

  async function handleTranslatableItem(id) {
    const itemState = await TranslationAgent.state(id)
    itemState.translations.paths.forEach(async path => {
      const translatableTargetName = `translatable_target/${JSON.stringify([id, ...path])}`
      const translatableTargetMetadata = await TranslationAgent.metadata(translatableTargetName)

      if (translatableTargetMetadata.active_type !== TRANSLATABLE_TARGET_TYPE) {
        translatableTargetMetadata.active_type = TRANSLATABLE_TARGET_TYPE
      }

      const translatableTarget = await TranslationAgent.state(translatableTargetName)
      const source_string = resolvePath([...path], itemState)

      translatableTarget.source_language = itemState.translations.source_language
      translatableTarget.source_string = source_string || null
      translatableTarget.path = [id, ...path]
    })
  }

  function resolvePath(path, value) {
      while (path.length && value) value = value[path.shift()]
      return value
    }

  async function isTranslatableItem(id) {
    const state = await Agent.state(id)
    //  TODO: validate schema
    return !!state.translations
  }
 
  // HANDLER AND DEFS FOR TAGS
  const TagAgent = getAgent('tags.knowlearning.systems')
  const agentTags = await TagAgent.state('tags')

  function addTag(tagId, contentId) {
    if (!agentTags.value[tagId]) agentTags.value[tagId] = {}
    agentTags.value[tagId][contentId] = true
  }

  Agent.on('child', child => {
    const { environment: { user } } = child

    child.on('mutate', ({ scope, patch }) => {
      if (scope === 'tags') {
        patch.forEach(async ({ path, value:patchValue }) => {
          if (path.length === 2) {
            const [ tagId, contentId ] = path
            const { value, partition=user } = patchValue
            if (!agentTags[tagId]) agentTags[tagId] = {}
            agentTags[tagId][contentId] = { contributor: user, partition, value }
          }
        })
      }
    })
  })
