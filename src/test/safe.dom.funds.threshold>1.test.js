// @flow
import { fireEvent, cleanup } from '@testing-library/react'
import { aNewStore } from '~/store'
import { aMinedSafe } from '~/test/builder/safe.redux.builder'
import { sendTokenTo, sendEtherTo } from '~/test/utils/tokenMovements'
import { renderSafeView } from '~/test/builder/safe.dom.utils'
import { getWeb3, getBalanceInEtherOf } from '~/logic/wallets/getWeb3'
import { dispatchAddTokenToList } from '~/test/utils/transactions/moveTokens.helper'
import { sleep } from '~/utils/timer'
import '@testing-library/jest-dom/extend-expect'
import { BALANCE_ROW_TEST_ID } from '~/routes/safe/components/Balances'
import { fillAndSubmitSendFundsForm } from './utils/transactions'
import { TRANSACTIONS_TAB_BTN_TESTID } from '~/routes/safe/components/Layout'
import { TRANSACTION_ROW_TEST_ID } from '~/routes/safe/components/TransactionsNew/TxsTable'
import { useTestAccountAt, resetTestAccount } from './utils/accounts'
import { CONFIRM_TX_BTN_TESTID, EXECUTE_TX_BTN_TESTID } from '~/routes/safe/components/TransactionsNew/TxsTable/ExpandedTx/OwnersColumn/ButtonRow'
import { APPROVE_TX_MODAL_SUBMIT_BTN_TESTID } from '~/routes/safe/components/TransactionsNew/TxsTable/ExpandedTx/ApproveTxModal'

afterEach(cleanup)
afterEach(resetTestAccount)

describe('DOM > Feature > Sending Funds', () => {
  let store
  let safeAddress: string
  let accounts
  beforeEach(async () => {
    store = aNewStore()
    // using 4th account because other accounts were used in other tests and paid gas
    safeAddress = await aMinedSafe(store, 2, 2)
    accounts = await getWeb3().eth.getAccounts()
  })

  it('Sends ETH with threshold = 2', async () => {
    // GIVEN
    const ethAmount = '5'
    await sendEtherTo(safeAddress, ethAmount)
    const balanceAfterSendingEthToSafe = await getBalanceInEtherOf(accounts[0])

    // WHEN
    const SafeDom = renderSafeView(store, safeAddress)
    await sleep(1300)

    // Open send funds modal
    const balanceRows = SafeDom.getAllByTestId(BALANCE_ROW_TEST_ID)
    expect(balanceRows[0]).toHaveTextContent(`${ethAmount} ETH`)
    const sendButton = SafeDom.getByTestId('balance-send-btn')
    fireEvent.click(sendButton)

    await fillAndSubmitSendFundsForm(SafeDom, sendButton, ethAmount, accounts[0])

    // CONFIRM TX
    fireEvent.click(SafeDom.getByTestId(TRANSACTIONS_TAB_BTN_TESTID))
    await sleep(200)

    useTestAccountAt(1)
    await sleep(2200)
    const txRows = SafeDom.getAllByTestId(TRANSACTION_ROW_TEST_ID)
    expect(txRows.length).toBe(1)

    fireEvent.click(txRows[0])
    await sleep(100)
    fireEvent.click(SafeDom.getByTestId(CONFIRM_TX_BTN_TESTID))
    await sleep(100)

    // Travel confirm modal
    fireEvent.click(SafeDom.getByTestId(APPROVE_TX_MODAL_SUBMIT_BTN_TESTID))
    await sleep(500)

    // EXECUTE TX
    fireEvent.click(SafeDom.getByTestId(EXECUTE_TX_BTN_TESTID))
    await sleep(100)
    fireEvent.click(SafeDom.getByTestId(APPROVE_TX_MODAL_SUBMIT_BTN_TESTID))
    await sleep(500)

    // THEN
    const safeFunds = await getBalanceInEtherOf(safeAddress)
    expect(Number(safeFunds)).toBe(0)

    const receiverFunds = await getBalanceInEtherOf(accounts[0])
    const ESTIMATED_GASCOSTS = 0.3
    expect(Number(parseInt(receiverFunds, 10) - parseInt(balanceAfterSendingEthToSafe, 10))).toBeGreaterThan(
      parseInt(ethAmount, 10) - ESTIMATED_GASCOSTS,
    )
  })
})
