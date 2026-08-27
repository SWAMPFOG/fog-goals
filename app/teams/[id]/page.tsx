
660
661
662
663
664
665
666
667
668
669
670
671
672
673
674
675
676
677
678
679
680
681
682
683
684
685
686
687
688
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
"use client";
                      オリシャン目標本数
                    </span>
                    <input
                      type="number"
                      inputMode="numeric"
                      value={champagneTarget}
                      onChange={(e) => setChampagneTarget(e.target.value)}
                      placeholder="10"
                      className="mt-2 w-full rounded-2xl border border-zinc-800 bg-black px-4 py-3 text-white outline-none"
                    />
                  </label>

                  <label className="block">
                    <span className="text-xs text-zinc-500">
                      来店組数目標
                    </span>
                    <input
                      type="number"
                      inputMode="numeric"
                      value={visitCountTarget}
                      onChange={(e) => setVisitCountTarget(e.target.value)}
                      placeholder="30"
                      className="mt-2 w-full rounded-2xl border border-zinc-800 bg-black px-4 py-3 text-white outline-none"
                    />
                  </label>
                </div>

                <button
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
