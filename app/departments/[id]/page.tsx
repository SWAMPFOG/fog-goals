
368
369
370
371
372
373
374
375
376
377
378
379
380
381
382
383
384
385
386
387
388
389
390
391
392
393
394
395
396
397
398
399
400
401
402
403
404
405
406
407
408
409
410
411
412
413
414
415
416
"use client";

              );

              const teamSales = teamResults.reduce(
                (sum, row) => sum + Number(row.sales ?? 0),
                0
              );

              return (
                <Link
                  key={team.id}
                  href={`/teams/${team.id}`}
                  className="block rounded-2xl border border-zinc-800 p-5"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-bold">{team.name}</p>

                      <p className="mt-2 text-sm text-zinc-500">
                        現在売上 {yen(teamSales)}
                      </p>
                    </div>

                    <span className="text-zinc-500">→</span>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      </div>
    </main>
  );
}


function DepartmentResultBox({
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
