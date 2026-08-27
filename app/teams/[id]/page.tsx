689
690
691
692
693
694
695
696
697
698
699
700
701
702
703
704
705
706
707
708
709
710
711
712
713
714
715
716
717
718
719
720
721
722
723
724
725
726
727
728
729
730
731
732
733
734
735
736
737
738
739
740
741
742
743
744
745
746
"use client";

                  onClick={saveGoal}
                  disabled={saving}
                  className="mt-6 w-full rounded-2xl bg-white py-4 font-bold text-black disabled:opacity-50"
                >
                  {saving ? "保存中..." : "保存する"}
                </button>
              </section>
            )}

            {message && (
              <p className="mt-4 text-center text-sm text-green-400">
                {message}
              </p>
            )}
          </>
        ) : null}
      </div>

      <nav className="fixed bottom-0 left-0 right-0 border-t border-zinc-900 bg-black/95">
        <div className="mx-auto grid max-w-md grid-cols-4">
          <Link
            href="/"
            className="py-4 text-center text-xs text-zinc-600"
          >
            ホーム
          </Link>

          <Link
            href="/members"
            className="py-4 text-center text-xs font-bold text-white"
          >
            メンバー
          </Link>

          <button className="py-4 text-xs text-zinc-600">日報</button>
          <button className="py-4 text-xs text-zinc-600">設定</button>
        </div>
      </nav>
    </main>
  );
}


function ResultBox({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl bg-zinc-900 p-4">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="mt-1 text-xl font-bold">{value}</p>
    </div>
  );
}
