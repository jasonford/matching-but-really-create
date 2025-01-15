<template>
<div class="player">
    <div
        v-if="item?.instructions"
        class="instructions"
    ><span class="instructions-prefix">{{ t('instructions') }}:</span>{{ item.instructions }}</div>
    <div
        v-if="item.selectMultiple"
        class="font-weight-bold"
    >{{ t('select-all-that-apply') }}</div>

    <div class="choices-wrapper">
        <v-checkbox class="checkbox-row"
            v-for="choice,i in item.choices"
            :key="`checkbox-for-choice-${i}`"
            :label="choice.value"
            :value="i"
            :multiple="item.selectMultiple"
            v-model="userSelect"
            hide-details
        />
    </div>
    <v-btn
        @click="handleSubmit"
        color="green"
        :text="t('submit')"
    />
</div>
</template>

<script setup>
import { ref, reactive, computed } from 'vue'
import { itemFeedbackSwal } from '../../helpers/swallows.js'
import translateScopeId from '../../helpers/translateScopeId.js'


import { useStore } from 'vuex'

const store = useStore()
function t(slug) { return store.getters.t(slug) }

const props = defineProps({
    id: {
        type: String,
        required: true
    }
})

const lang = store.getters.language()
const item = await translateScopeId(props.id, lang)

const response = reactive(await Agent.state(`multiple-choice/${props.id}`))
if (!response.selection) response.selection = []

const userSelect = computed({
  get() { return item.selectMultiple ? response.selection : response.selection[0] },
  set(value) { response.selection = item.selectMultiple ? value : [value] }
})

function isCorrect() {
    const neededIndices = []
    item.choices.forEach((c,i) => c.isCorrect && neededIndices.push(i))
    const all = neededIndices.every(i => response.selection.includes(i))
    const only = response.selection.every(i => neededIndices.includes(i))
    return all && only
}

async function handleSubmit() {
    const success = isCorrect()
    if (Agent.embedded) Agent.close({
        success,
        message: getMessage(success)
    })
    else await itemFeedbackSwal(t, success, getMessage(success))

    response.xapi = {
        verb: 'http://adlnet.gov/expapi/verbs/answered',
        object: props.id,
        result: {
            success,
            completion: true
        },
//        context,
//        authority
    }
}

function getMessage(isCorrect) {
    if (isCorrect && item.feedback?.correct) return item.feedback.correct 
    else if (!isCorrect && item.feedback?.incorrect) return item.feedback.incorrect
    else return undefined
}

</script>

<style scoped>
.player {
    display: flex;
    flex-direction: column;
    align-items: center;
    margin: 0 8px;
}
.choices-wrapper {
    width: 100%;
    max-width: 500px;
    border-bottom: 1px solid grey;
    margin: 12px 0;
}
.checkbox-row {
    border-top: 1px solid grey;
    text-align: left;
    padding: 8px 0;
}
</style>