import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { Role } from "@/generated/prisma/enums";
import { getFinanceReport } from "@/lib/finance-reports";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== Role.ADMIN) {
    return Response.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { startDate, endDate } = await req.json();

  try {
    const report = await getFinanceReport(new Date(startDate), new Date(endDate));
    return Response.json(report);
  } catch (error) {
    console.error("Finance report error:", error);
    return Response.json({ error: "Failed to generate report" }, { status: 500 });
  }
}
