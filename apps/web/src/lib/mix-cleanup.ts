import path from "path";
import fs from "fs/promises";
import { prisma } from "./prisma";
import { deleteGeneratedVideoFiles } from "./job-cleanup";

export async function removeStaleMixes(): Promise<number> {
  const mixes = await prisma.mix.findMany({
    include: {
      videoJobs: { include: { generatedVideo: true } },
    },
  });

  let removed = 0;

  for (const mix of mixes) {
    try {
      await fs.access(mix.filepath);
      continue;
    } catch {
      /* file missing on disk */
    }

    for (const job of mix.videoJobs) {
      if (job.generatedVideo) {
        await deleteGeneratedVideoFiles(job.generatedVideo);
      }
    }

    if (mix.waveformPath) {
      try {
        await fs.unlink(mix.waveformPath);
      } catch {
        /* ignore */
      }
    }

    await prisma.mix.delete({ where: { id: mix.id } });
    removed++;
  }

  return removed;
}
