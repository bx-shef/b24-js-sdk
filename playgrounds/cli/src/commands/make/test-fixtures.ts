import { EnumCrmEntityTypeId, SdkError } from '@bitrix24/b24jssdk'
import { appendFileSync } from 'node:fs'
import { defineCommand } from 'citty'
import 'dotenv/config'
import { CLIENT_ERROR_STATUS } from '../../constants'
import { createB24Client } from '../../utils'

/**
 * Finds or creates the records the integration tests rely on, and prints their IDs
 * as `B24_TEST_IDS` (see `test/0_setup/test-ids.ts`).
 *
 * Idempotent: every record carries the {@link MARKER} in its title, so a second run
 * reuses what the first one made and creates only what is missing. Nothing is
 * deleted or updated.
 *
 * What the tests need:
 * - companies: at least {@link COMPANIES}, titled `A…` (CallListV2 filters `A%`),
 *   one of them created within the last ~6 months; `>crmCompanySuccessMax` must
 *   still return rows, so Max is the second-to-last marked company;
 * - contacts: at least {@link CONTACTS}; one deal; one task;
 * - `taskWrong` / `crmCompanyWrong`: an ID that does not exist.
 *
 * @usage pnpm --filter @bitrix24/b24jssdk-cli dev make test-fixtures
 * @usage pnpm --filter @bitrix24/b24jssdk-cli dev make test-fixtures --githubEnv
 */

const MARKER = 'b24jssdk-test'
const COMPANIES = 4
const CONTACTS = 2
/** CallListV2 looks back 6 months; keep a margin so a fresh company appears in time. */
const RECENT_DAYS = 150
/** Far above any real ID on a test portal, so `get` answers "not found". */
const MISSING_ID = 2_000_000_000

interface CrmRow { id: number, createdTime?: string }

export default defineCommand({
  meta: {
    name: 'test-fixtures',
    description: 'Find or create the records the integration tests need; print B24_TEST_IDS'
  },
  args: {
    githubEnv: {
      type: 'boolean',
      description: 'Also append B24_TEST_IDS to the file in $GITHUB_ENV (GitHub Actions)',
      default: false
    }
  },
  async setup({ args }) {
    const { b24, logger } = createB24Client('test-fixtures')

    async function call<T>(method: string, params: Record<string, unknown>): Promise<T> {
      const response = await b24.actions.v2.call.make<T>({ method, params, requestId: `test-fixtures/${method}` })
      if (!response.isSuccess) {
        throw new SdkError({
          code: 'PLAYGROUND_CLI_FIXTURES',
          description: `${method}: ${response.getErrorMessages().join('; ')}`,
          status: CLIENT_ERROR_STATUS
        })
      }
      return response.getData()!.result
    }

    // Contacts have no `title`; the marker goes into the last name there.
    async function markedCrm(entityTypeId: number): Promise<CrmRow[]> {
      const field = entityTypeId === EnumCrmEntityTypeId.contact ? '%lastName' : '%title'
      const result = await call<{ items: CrmRow[] }>('crm.item.list', {
        entityTypeId,
        filter: { [field]: MARKER },
        select: ['id', 'createdTime'],
        order: { id: 'ASC' }
      })
      return result.items
    }

    async function addCrm(entityTypeId: number, fields: Record<string, unknown>): Promise<CrmRow> {
      const result = await call<{ item: CrmRow }>('crm.item.add', { entityTypeId, fields })
      logger.info(`created ${entityTypeId === EnumCrmEntityTypeId.company ? 'company' : entityTypeId === EnumCrmEntityTypeId.contact ? 'contact' : 'deal'} #${result.item.id}`).catch(() => {})
      return result.item
    }

    const companies = await markedCrm(EnumCrmEntityTypeId.company)
    const recentFrom = Date.now() - RECENT_DAYS * 24 * 3600 * 1000
    const hasRecent = companies.some(row => row.createdTime && Date.parse(row.createdTime) >= recentFrom)
    const addCompany = async () => {
      companies.push(await addCrm(EnumCrmEntityTypeId.company, { title: `Alpha ${MARKER} ${companies.length + 1}` }))
    }
    const missing = COMPANIES - companies.length
    while (companies.length < COMPANIES) {
      await addCompany()
    }
    if (!hasRecent && missing <= 0) {
      // Every marked company is old: CallListV2 would find none of them.
      await addCompany()
    }

    const contacts = await markedCrm(EnumCrmEntityTypeId.contact)
    while (contacts.length < CONTACTS) {
      contacts.push(await addCrm(EnumCrmEntityTypeId.contact, { name: 'Test', lastName: MARKER }))
    }

    const deals = await markedCrm(EnumCrmEntityTypeId.deal)
    if (deals.length === 0) {
      deals.push(await addCrm(EnumCrmEntityTypeId.deal, { title: `${MARKER} deal` }))
    }

    const me = await call<{ ID: string }>('user.current', {})
    const tasks = await call<{ tasks: { id: string }[] }>('tasks.task.list', {
      filter: { '%TITLE': MARKER },
      select: ['ID'],
      order: { ID: 'ASC' }
    })
    let taskId = Number(tasks.tasks[0]?.id)
    if (!taskId) {
      const added = await call<{ task: { id: string } }>('tasks.task.add', {
        fields: { TITLE: `${MARKER} task`, RESPONSIBLE_ID: Number(me.ID) }
      })
      taskId = Number(added.task.id)
      logger.info(`created task #${taskId}`).catch(() => {})
    }

    const ids = {
      taskSuccess: taskId,
      taskFail: -1,
      taskWrong: MISSING_ID,
      crmDealSuccessMin: deals[0]!.id,
      crmDealSuccessMax: deals[0]!.id,
      crmContactSuccessMin: contacts[0]!.id,
      crmContactSuccessMax: contacts[contacts.length - 1]!.id,
      crmCompanySuccessMin: companies[0]!.id,
      crmCompanySuccessMax: companies[companies.length - 2]!.id,
      crmCompanyFail: -1,
      crmCompanyWrong: MISSING_ID
    }
    const line = `B24_TEST_IDS=${JSON.stringify(ids)}`

    // The result is the last line of output, so `| tail -1 >> .env.test` works.
    console.log(line)
    if (args.githubEnv) {
      const file = process.env.GITHUB_ENV
      if (!file) {
        throw new SdkError({
          code: 'PLAYGROUND_CLI_NO_GITHUB_ENV',
          description: '--githubEnv: GITHUB_ENV is not set',
          status: CLIENT_ERROR_STATUS
        })
      }
      appendFileSync(file, `${line}\n`)
    }
  }
})
