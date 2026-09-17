import {
  Button,
  SelectField,
  SwitchField,
  TextField,
  TextareaField
} from 'datocms-react-ui'
import s from '../searchReplace.module.css'
import type { SearchableModel } from '../searchReplace.services'
import type { ParsedTarget } from '../urlTargets'
import { searchableTargets } from '../urlTargets'

type Option = { label: string; value: string }

export type ScanFormProps = {
  models: SearchableModel[]
  model: SearchableModel | null
  onModelChange: (id: string | null) => void
  find: string
  onFindChange: (value: string) => void
  replace: string
  onReplaceChange: (value: string) => void
  urls: string
  onUrlsChange: (value: string) => void
  caseSensitive: boolean
  onCaseSensitiveChange: (value: boolean) => void
  wholeWord: boolean
  onWholeWordChange: (value: boolean) => void
  targets: ParsedTarget[]
  canScan: boolean
  busy: boolean
  onScan: () => void
}

export const ScanForm = ({
  models,
  model,
  onModelChange,
  find,
  onFindChange,
  replace,
  onReplaceChange,
  urls,
  onUrlsChange,
  caseSensitive,
  onCaseSensitiveChange,
  wholeWord,
  onWholeWordChange,
  targets,
  canScan,
  busy,
  onScan
}: ScanFormProps) => {
  const options: Option[] = models.map((candidate) => ({
    // Whether a model has a slug field is only known once it is chosen, so
    // the list cannot say — and must not imply otherwise.
    label: candidate.name,
    value: candidate.id
  }))
  const selected = options.find((option) => option.value === model?.id) ?? null
  const searchable = searchableTargets(targets).length

  return (
    <div className={s.panel}>
      <div className={s.grid}>
        <SelectField
          name='model'
          id='model'
          label='Model to search in'
          hint={
            model?.slugFieldChecked && !model.slugFieldApiKey
              ? 'This model has no slug field, so page URLs cannot be matched to records.'
              : 'Only records of this model are searched.'
          }
          value={selected}
          onChange={(next) =>
            onModelChange((next as Option | null)?.value ?? null)
          }
          selectInputProps={{ options, isClearable: true }}
        />

        <div />

        <TextField
          name='find'
          id='find'
          label='Find'
          placeholder='https://factorial.ke/privacy'
          value={find}
          onChange={onFindChange}
        />

        <TextField
          name='replace'
          id='replace'
          label='Replace with'
          placeholder='https://trust.factorial.co/'
          hint='Leave empty to delete the matched text.'
          value={replace}
          onChange={onReplaceChange}
        />

        <div className={s.fullWidth}>
          <TextareaField
            name='urls'
            id='urls'
            label='Pages to search in'
            hint={`One URL per line. The market locale is read from each URL; /blog URLs are skipped. ${searchable} of ${targets.length} line(s) will be searched.`}
            placeholder={
              'https://factorial.ke/partnerships\nhttps://factorial.ke/payroll'
            }
            value={urls}
            onChange={onUrlsChange}
            textareaInputProps={{ rows: 8 }}
          />
        </div>
      </div>

      <div className={s.optionsRow}>
        <SwitchField
          name='caseSensitive'
          id='caseSensitive'
          label='Match case'
          value={caseSensitive}
          onChange={onCaseSensitiveChange}
        />
        <SwitchField
          name='wholeWord'
          id='wholeWord'
          label='Whole words only'
          value={wholeWord}
          onChange={onWholeWordChange}
        />
      </div>

      <div className={s.actions}>
        <Button
          buttonType='primary'
          disabled={!canScan || busy}
          onClick={onScan}
        >
          Dry run
        </Button>
        <span className={s.info}>
          Nothing is written until you apply a change from the results below.
        </span>
      </div>
    </div>
  )
}
