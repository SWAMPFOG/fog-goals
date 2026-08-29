R: {errorMessage}</p>
          </section>
        )}

        <section className="grid grid-cols-3 gap-2">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-3">
            <p className="text-[11px] text-zinc-500">今月売上</p>
            <p className="mt-2 text-base font-bold">{yen(totalSales)}</p>
          </div>
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-3">
            <p className="text-[11px] text-zinc-500">顧客数</p>
            <p className="mt-2 text-base font-bold">{clientCount}人</p>
          </div>
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-3">
            <p className="text-[11px] text-zinc-500">客単価</p>
            <p className="mt-2 text-base font-bold">{yen(average)}</p>
          </div>
        </section>

        {!isCast && (
          <section className="mt-5 rounded-3xl border border-zinc-800 bg-zinc-950 p-5">
            <p className="text-xs text-zinc-500">ADD SALES</p>
            <h2 className="mt-2 text-xl font-bold">売上を登録</h2>

            <div className="mt-5 space-y-3">
              <input
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="クライアント名"
                className="w-full rounded-2xl border border-zinc-800 bg-black px-4 py-3 text-white"
              />

              <input
                type="number"
                inputMode="numeric"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="売上金額"
                className="w-full rounded-2xl border border-zinc-800 bg-black px-4 py-3 text-white"
              />

              <input
                type="date"
                value={visitDate}
                onChange={(e) => setVisitDate(e.target.value)}
                className="w-full rounded-2xl border border-zinc-800 bg-black px-4 py-3 text-white"
              />

              <select
                value={memberId}
                onChange={(e) => setMemberId(e.target.value)}
                className="w-full rounded-2xl border border-zinc-800 bg-black px-4 py-3 text-white"
              >
                <option value="">担当キャストを選択</option>
                {members.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name}
                  </option>
                ))}
              </select>

              <button
                onClick={addSale}
                disabled={saving}
                className="w-full rounded-2xl bg-white py-4 font-bold text-black disabled:opacity-50"
              >
                {saving ? "登録中..." : "登録する"}
              </button>

              {message && (
                <p className="text-center text-sm text-green-400">{message}</p>
              )}
            </div>
          </section>
        )}


        {!isCast && (
          <section className="mt-6 rounded-3xl border border-zinc-800 bg-zinc-950 p-5">
            <p className="text-xs text-zinc-500">SALES HISTORY</p>
            <h2 className="mt-2 text-xl font-bold">登録履歴</h2>

            <div className="mt-5 space-y-3">
              {sales.length === 0 ? (
                <p className="text-sm text-zinc-500">登録はありません</p>
              ) : (
                sales.map((row) => {
                  const memberName =
                    members.find((m) => m.id === row.member_id)?.name ?? "担当";

                  if (editingSaleId === row.id) {
                    return (
                      <div
                        key={row.id}
                        className="rounded-2xl border border-zinc-700 bg-zinc-900 p-4"
                      >
                        <div className="space-y-3">
                          <input
                            value={editClientName}
                            onChange={(e) => setEditClientName(e.target.value)}
                            placeholder="クライアント名"
                            className="w-full rounded-xl border border-zinc-700 bg-black px-3 py-3 text-white"
                          />

                          <input
                            type="number"
                            inputMode="numeric"
                            value={editAmount}
                            onChange={(e) => setEditAmount(e.target.value)}
                            placeholder="売上金額"
                            className="w-full rounded-xl border border-zinc-700 bg-black px-3 py-3 text-white"
                          />

                          <input
                            type="date"
                            value={editVisitDate}
                            onChange={(e) => setEditVisitDate(e.target.value)}
                            className="w-full rounded-xl border border-zinc-700 bg-black px-3 py-3 text-white"
                          />

                          <select
                            value={editMemberId}
                            onChange={(e) => setEditMemberId(e.target.value)}
                            className="w-full rounded-xl border border-zinc-700 bg-black px-3 py-3 text-white"
                          >
                            <option value="">担当キャストを選択</option>
                            {members.map((member) => (
                              <option key={member.id} value={member.id}>
                                {member.name}
                              </option>
                            ))}
                          </select>

                          <div className="grid grid-cols-2 gap-2">
                            <button
                              onClick={cancelEdit}
                              className="rounded-xl border border-zinc-700 py-3 text-sm"
                            >
                              キャンセル
                            </button>
                            <button
                              onClick={() => saveEdit(row)}
                              disabled={saving}
                              className="rounded-xl bg-white py-3 text-sm font-bold text-black disabled:opacity-50"
                            >
                              {saving ? "保存中..." : "保存"}
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={row.id}
                      className="rounded-2xl bg-zinc-900 p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-bold">{row.client_name}</p>
                          <p className="mt-1 text-xs text-zinc-500">
                            {memberName} / {row.visit_date.replaceAll("-", "/")}
                          </p>
                        </div>
                        <p className="font-bold">{yen(row.amount)}</p>
                      </div>

                      <div className="mt-4 grid grid-cols-2 gap-2">
                        <button
                          onClick={() => startEdit(row)}
                          className="rounded-xl border border-zinc-700 py-2 text-sm"
                        >
                          編集
                        </button>
                        <button
                          onClick={() => deleteSale(row)}
                          className="rounded-xl border border-red-900 py-2 text-sm text-red-400"
                        >
                          削除
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </section>
        )}

        <section className="mt-6 rounded-3xl border border-zinc-800 bg-zinc-950 p-5">
          <p className="text-xs text-zinc-500">THIS MONTH</p>
          <h2 className="mt-2 text-xl font-bold">クライアント別売上</h2>

          <div className="mt-5 space-y-2">
            {groupedClients.length === 0 ? (
              <p className="text-sm text-zinc-500">今月の売上登録はありません</p>
            ) : (
              groupedClients.map((client, index) => (
                <div
                  key={client.clientName}
                  className="rounded-2xl bg-zinc-900 px-4 py-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs text-zinc-600">{index + 1}位</p>
                      <p className="mt-1 font-bold">{client.clientName}</p>
                    </div>

                    <p className="font-bold">{yen(client.total)}</p>
                  </div>

                  <div className="mt-3 flex justify-between text-xs text-zinc-500">
                    <span>来店 {client.visits}回</span>
                    <span>最終 {client.latest.replaceAll("-", "/")}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </main>
  );
}