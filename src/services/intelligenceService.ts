import { FinalPublishedFuelPrice } from "../models/FinalPublishedFuelPrice";
import { NormalizedFuelRecord } from "../models/NormalizedFuelRecord";
import FuelPriceLog from "../models/FuelPriceLog";
import type { FuelType } from "../models/enums";

export interface IntelligenceOutput {
  location: string;
  fuel_type: FuelType;
  average_price: number | null;
  min_price: number | null;
  max_price: number | null;
  cheapest_station: string | null;
  trend: "up" | "down" | "stable" | "unknown";
  confidence_score: number;
  sources: Array<{ type: string; weight: number }>;
  notes: string;
}

export class IntelligenceService {
  private static readonly TARGET_LOCATION = "Atimonan, Quezon";
  private static readonly NEARBY_LOCATIONS = ["Pagbilao", "Plaridel", "Gumaca"];

  /**
   * Generates location-specific fuel intelligence for Atimonan.
   */
  static async getFuelIntelligence(fuelType: FuelType): Promise<IntelligenceOutput> {
    // 1. Fetch data for Atimonan
    const directRecords = await FinalPublishedFuelPrice.find({
      fuelType,
      $or: [
        { city: { $regex: /atimonan/i } },
        { region: "Luzon", city: { $regex: /atimonan/i } }
      ]
    }).sort({ lastVerifiedAt: -1 }).limit(10);

    const userReports = await FuelPriceLog.find({
      fuelType,
      source: "USER",
      isOutlier: false,
      locationName: { $regex: /atimonan/i },
      reportedAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } // Last 7 days
    }).sort({ reportedAt: -1 });

    // Filter user reports for Atimonan (assuming location is stored or can be inferred)
    // For this specialized agent, we expect user reports to have a way to filter by city.
    // If the stationId references a Station model, we'd look it up.
    // For now, let's assume we filter by city in a simple way or that the current scope is pre-filtered.

    let prices: number[] = [];
    let sourceWeights: Array<{ type: string; weight: number }> = [];
    let notesArr: string[] = [];

    // Process direct official/scraped data
    if (directRecords.length > 0) {
      directRecords.forEach(r => {
        if (r.finalPrice) prices.push(r.finalPrice);
      });
      sourceWeights.push({ type: "Official/Scraped", weight: 0.6 });
      notesArr.push(`Found ${directRecords.length} official/advisory records.`);
    }

    // Process user reports
    if (userReports.length > 0) {
      userReports.forEach(r => prices.push(r.price));
      sourceWeights.push({ type: "User Reports", weight: 0.4 });
      notesArr.push(`Included ${userReports.length} recent user reports.`);
    }

    // FALLBACK: Use nearby towns if no direct data
    if (prices.length === 0) {
      const nearbyRecords = await FinalPublishedFuelPrice.find({
        fuelType,
        city: { $in: this.NEARBY_LOCATIONS.map(c => new RegExp(c, "i")) }
      }).sort({ lastVerifiedAt: -1 }).limit(5);

      if (nearbyRecords.length > 0) {
        nearbyRecords.forEach(r => {
          if (r.finalPrice) prices.push(r.finalPrice);
        });
        sourceWeights.push({ type: "Nearby Town Data", weight: 0.3 });
        notesArr.push(`No direct Atimonan data. Estimated using nearby towns: ${this.NEARBY_LOCATIONS.join(", ")}.`);
      }
    }

    if (prices.length === 0) {
      return {
        location: this.TARGET_LOCATION,
        fuel_type: fuelType,
        average_price: null,
        min_price: null,
        max_price: null,
        cheapest_station: null,
        trend: "unknown",
        confidence_score: 0,
        sources: [],
        notes: "No sufficient data available for Atimonan yet."
      };
    }

    const avg = prices.reduce((a, b) => a + b, 0) / prices.length;
    const min = Math.min(...prices);
    const max = Math.max(...prices);

    // Trend analysis (simple comparison with older data)
    let trend: "up" | "down" | "stable" | "unknown" = "stable";
    const lastMonth = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const oldRecords = await FinalPublishedFuelPrice.find({
      fuelType,
      city: /atimonan/i,
      lastVerifiedAt: { $lt: lastMonth }
    }).sort({ lastVerifiedAt: -1 }).limit(1);

    if (oldRecords.length > 0 && oldRecords[0].finalPrice) {
      const diff = avg - oldRecords[0].finalPrice;
      if (diff > 0.1) trend = "up";
      else if (diff < -0.1) trend = "down";
    }

    // Confidence Score Calculation
    let confidence = 0.5; // Base confidence
    if (directRecords.length > 0) confidence += 0.3;
    if (userReports.length > 5) confidence += 0.1;
    if (prices.length > 10) confidence += 0.1;
    confidence = Math.min(0.99, confidence);

    return {
      location: this.TARGET_LOCATION,
      fuel_type: fuelType,
      average_price: parseFloat(avg.toFixed(2)),
      min_price: parseFloat(min.toFixed(2)),
      max_price: parseFloat(max.toFixed(2)),
      cheapest_station: "Various Stations (Atimonan)", // In a real app, find station with min price
      trend,
      confidence_score: confidence,
      sources: sourceWeights,
      notes: notesArr.join(" ")
    };
  }

  /**
   * Chatbot interface for querying Atimonan fuel data.
   */
  static async handleChatQuery(query: string): Promise<string> {
    const q = query.toLowerCase();
    let fuelType: FuelType = "Gasoline";
    
    if (q.includes("diesel")) fuelType = "Diesel";
    else if (q.includes("kerosene")) fuelType = "Kerosene";

    const intel = await this.getFuelIntelligence(fuelType);

    if (intel.confidence_score === 0) {
      return "I'm sorry, I don't have enough data for fuel prices in Atimonan right now.";
    }

    if (q.includes("price") || q.includes("how much") || q.includes("cost")) {
      return `The current average price for ${fuelType} in Atimonan is ₱${intel.average_price}. Prices range from ₱${intel.min_price} to ₱${intel.max_price}. (Confidence: ${Math.round(intel.confidence_score * 100)}%)`;
    }

    if (q.includes("cheapest") || q.includes("lowest")) {
      return `The cheapest ${fuelType} in Atimonan is around ₱${intel.min_price}. ${intel.notes}`;
    }

    if (q.includes("trend") || q.includes("increase") || q.includes("decrease") || q.includes("movement")) {
      const trendText = intel.trend === "up" ? "increasing" : intel.trend === "down" ? "decreasing" : "stable";
      return `The price of ${fuelType} in Atimonan is currently ${trendText}. The average is ₱${intel.average_price}.`;
    }

    return `I have the following data for ${fuelType} in Atimonan: Average ₱${intel.average_price}, Range ₱${intel.min_price}-₱${intel.max_price}. Trend: ${intel.trend}. How else can I help?`;
  }
}
