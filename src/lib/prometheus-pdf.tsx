import React from "react";
import { Document, Page, Text, View, StyleSheet, pdf } from "@react-pdf/renderer";

const navy = "#0f172a";
const gold = "#f59e0b";
const white = "#ffffff";
const gray = "#94a3b8";
const lightGray = "#e2e8f0";

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: "Helvetica", fontSize: 10, color: "#1e293b" },
  header: { backgroundColor: navy, padding: 16, marginBottom: 0, borderRadius: 4 },
  headerTitle: { color: gold, fontSize: 16, fontFamily: "Helvetica-Bold", marginBottom: 8 },
  headerRow: { flexDirection: "row", justifyContent: "space-between" },
  headerCol: { width: "48%" },
  headerLabel: { color: gray, fontSize: 8, marginBottom: 2 },
  headerValue: { color: white, fontSize: 10, marginBottom: 4 },
  divider: { height: 2, backgroundColor: gold, marginVertical: 12 },
  section: { marginBottom: 12 },
  sectionTitle: { fontSize: 12, fontFamily: "Helvetica-Bold", color: navy, marginBottom: 6 },
  text: { fontSize: 10, lineHeight: 1.5, color: "#334155" },
  table: { width: "100%", marginTop: 4 },
  tableHeader: { flexDirection: "row", backgroundColor: navy, padding: 6 },
  tableHeaderCell: { color: white, fontSize: 8, fontFamily: "Helvetica-Bold" },
  tableRow: { flexDirection: "row", padding: 6, borderBottomWidth: 0.5, borderBottomColor: lightGray },
  tableCell: { fontSize: 9, color: "#334155" },
  bullet: { fontSize: 10, color: "#d97706", marginBottom: 3 },
  footer: { position: "absolute", bottom: 30, left: 40, right: 40 },
  footerDivider: { height: 1, backgroundColor: lightGray, marginBottom: 8 },
  footerRow: { flexDirection: "row", justifyContent: "space-between" },
  footerText: { fontSize: 8, color: gray },
  badge: { fontSize: 9, fontFamily: "Helvetica-Bold", color: gold },
  greenBanner: { backgroundColor: "#dcfce7", padding: 8, borderRadius: 3, marginBottom: 8 },
  greenText: { color: "#166534", fontSize: 10, fontFamily: "Helvetica-Bold" },
});

interface WorkOrderDraftWithRelations {
  id: string;
  title: string;
  description: string;
  category: string;
  priority: string;
  trade: string | null;
  buildingId: string;
  unitId: string | null;
  incidentDate: Date | null;
  scheduledDate: Date | null;
  assignedToId: string | null;
  accessAttempts: any;
  flaggedIssues: any;
  similarWOIds: any;
  photoUrls: any;
  verifiedByUserId: string | null;
  verifiedAt: Date | null;
  createdAt: Date;
  status: string;
  building?: { address: string } | null;
  verifiedBy?: { name: string } | null;
}

function fmtDate(d: Date | string | null): string {
  if (!d) return "N/A";
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function PDFDocument({ draft }: { draft: WorkOrderDraftWithRelations }) {
  const accessAttempts = Array.isArray(draft.accessAttempts) ? draft.accessAttempts : [];
  const flaggedIssues = Array.isArray(draft.flaggedIssues) ? draft.flaggedIssues : [];
  const similarIds = Array.isArray(draft.similarWOIds) ? draft.similarWOIds : [];

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        {/* HEADER */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>ATLASPM | WORK ORDER PACKAGE</Text>
          <View style={styles.headerRow}>
            <View style={styles.headerCol}>
              <Text style={styles.headerLabel}>BUILDING</Text>
              <Text style={styles.headerValue}>{draft.building?.address || "N/A"}</Text>
              <Text style={styles.headerLabel}>UNIT</Text>
              <Text style={styles.headerValue}>{draft.unitId || "Common Area"}</Text>
              <Text style={styles.headerLabel}>INCIDENT DATE</Text>
              <Text style={styles.headerValue}>{fmtDate(draft.incidentDate)}</Text>
            </View>
            <View style={styles.headerCol}>
              <Text style={styles.headerLabel}>DATE GENERATED</Text>
              <Text style={styles.headerValue}>{fmtDate(new Date())}</Text>
              <Text style={styles.headerLabel}>PRIORITY</Text>
              <Text style={[styles.headerValue, { color: gold }]}>{draft.priority}</Text>
              <Text style={styles.headerLabel}>CATEGORY</Text>
              <Text style={styles.headerValue}>{draft.category}</Text>
            </View>
          </View>
        </View>

        <View style={styles.divider} />

        {/* TITLE */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{draft.title}</Text>
        </View>

        {/* DESCRIPTION */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Description</Text>
          <Text style={styles.text}>{draft.description}</Text>
        </View>

        <View style={styles.divider} />

        {/* ACCESS ATTEMPTS */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Access Attempts</Text>
          {accessAttempts.length > 0 ? (
            <View style={styles.table}>
              <View style={styles.tableHeader}>
                <Text style={[styles.tableHeaderCell, { width: "25%" }]}>Date</Text>
                <Text style={[styles.tableHeaderCell, { width: "25%" }]}>Result</Text>
                <Text style={[styles.tableHeaderCell, { width: "50%" }]}>Notes</Text>
              </View>
              {accessAttempts.map((a: any, i: number) => (
                <View style={styles.tableRow} key={i}>
                  <Text style={[styles.tableCell, { width: "25%" }]}>{a.date || "N/A"}</Text>
                  <Text style={[styles.tableCell, { width: "25%" }]}>{a.result || "N/A"}</Text>
                  <Text style={[styles.tableCell, { width: "50%" }]}>{a.notes || ""}</Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.text}>No access attempts recorded</Text>
          )}
        </View>

        <View style={styles.divider} />

        {/* AI FLAGS */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>AI Flags</Text>
          {flaggedIssues.length > 0 ? (
            flaggedIssues.map((flag: string, i: number) => (
              <Text style={styles.bullet} key={i}>  {"\u2022"} {flag}</Text>
            ))
          ) : (
            <View style={styles.greenBanner}>
              <Text style={styles.greenText}>No flags — package complete</Text>
            </View>
          )}
        </View>

        <View style={styles.divider} />

        {/* SIMILAR PAST WORK ORDERS */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Similar Past Work Orders</Text>
          {similarIds.length > 0 ? (
            <View style={styles.table}>
              <View style={styles.tableHeader}>
                <Text style={[styles.tableHeaderCell, { width: "70%" }]}>Title</Text>
                <Text style={[styles.tableHeaderCell, { width: "30%" }]}>ID</Text>
              </View>
              {similarIds.map((id: string, i: number) => (
                <View style={styles.tableRow} key={i}>
                  <Text style={[styles.tableCell, { width: "70%" }]}>Work Order</Text>
                  <Text style={[styles.tableCell, { width: "30%" }]}>{id.slice(0, 12)}...</Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.text}>No similar records found</Text>
          )}
        </View>

        {/* FOOTER */}
        <View style={styles.footer}>
          <View style={styles.footerDivider} />
          <View style={styles.footerRow}>
            <View>
              <Text style={styles.footerText}>Assigned To: {draft.assignedToId || "Unassigned"}</Text>
              <Text style={styles.footerText}>
                Verified By: {draft.verifiedBy?.name || "Pending"}{draft.verifiedAt ? ` — ${fmtDate(draft.verifiedAt)}` : ""}
              </Text>
            </View>
            <View>
              <Text style={styles.footerText}>Package ID: {draft.id}</Text>
              <Text style={styles.footerText}>Generated by AtlasPM | Confidential</Text>
            </View>
          </View>
        </View>
      </Page>
    </Document>
  );
}

export async function generatePrometheusPDF(draft: WorkOrderDraftWithRelations): Promise<Buffer> {
  const doc = <PDFDocument draft={draft} />;
  const asPdf = pdf(doc);
  const blob = await asPdf.toBlob();
  const arrayBuffer = await blob.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
