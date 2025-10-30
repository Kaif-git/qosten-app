-- Create chapter_overviews table for storing chapter overview summaries
CREATE TABLE IF NOT EXISTS chapter_overviews (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  overview_data JSONB NOT NULL,
  subject VARCHAR(100),
  grade_level VARCHAR(50),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX idx_chapter_overviews_name ON chapter_overviews(name);
CREATE INDEX idx_chapter_overviews_subject ON chapter_overviews(subject);
CREATE INDEX idx_chapter_overviews_data ON chapter_overviews USING GIN(overview_data);

-- Create trigger to auto-update updated_at
CREATE TRIGGER update_chapter_overviews_updated_at
  BEFORE UPDATE ON chapter_overviews
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security (RLS)
ALTER TABLE chapter_overviews ENABLE ROW LEVEL SECURITY;

-- Create policy to allow read access to all users
CREATE POLICY "Allow read access to all users" ON chapter_overviews
  FOR SELECT
  USING (true);

-- Create policy to allow insert/update/delete for authenticated users only
CREATE POLICY "Allow insert for authenticated users" ON chapter_overviews
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Allow update for authenticated users" ON chapter_overviews
  FOR UPDATE
  USING (auth.role() = 'authenticated');

CREATE POLICY "Allow delete for authenticated users" ON chapter_overviews
  FOR DELETE
  USING (auth.role() = 'authenticated');

-- Insert example overview data
INSERT INTO chapter_overviews (name, overview_data, subject, grade_level) VALUES
(
  'Physics Chapter 4: Work, Energy, and Power',
  '{
    "topics": [
      {
        "id": "T-01",
        "title": "Work",
        "points": [
          {
            "text": "**Definition:** Work is done when a force causes an object to move.",
            "subpoints": []
          },
          {
            "text": "**Formula:** It is calculated as \\( W = F \\times s \\), where:",
            "subpoints": [
              "\\( W \\) is Work",
              "\\( F \\) is the Force applied",
              "\\( s \\) is the Displacement in the direction of the force"
            ]
          },
          {
            "text": "**It''s a Scalar:** Work has only magnitude, not direction.",
            "subpoints": []
          },
          {
            "text": "**Unit:** The unit of work is the Joule (J). \\( 1 \\, \\text{J} = 1 \\, \\text{N} \\cdot \\text{m} \\).",
            "subpoints": []
          },
          {
            "text": "**Three Types of Work:**",
            "subpoints": [
              "**Positive Work:** Happens when the force and displacement are in the *same* direction (e.g., pushing a car forward).",
              "**Negative Work:** Happens when the force and displacement are in *opposite* directions (e.g., friction slowing down a moving object).",
              "**Zero Work:** Happens when a force is applied but there is *no displacement* (e.g., pushing a wall that doesn''t move)."
            ]
          }
        ]
      },
      {
        "id": "T-02",
        "title": "Energy",
        "points": [
          {
            "text": "**Definition:** Energy is the ability to do work.",
            "subpoints": []
          },
          {
            "text": "**Scalar Quantity:** Like work, it has magnitude but no direction.",
            "subpoints": []
          },
          {
            "text": "**The Work-Energy Relationship:**",
            "subpoints": [
              "Positive work *adds* energy to an object.",
              "Negative work *removes* energy from an object."
            ]
          },
          {
            "text": "**Two Main Categories of Energy Sources:**",
            "subpoints": [
              "**Renewable Energy:** Sources that won''t run out.",
              "Examples: Solar, Wind, Hydropower, Geothermal, Biomass.",
              "**Non-Renewable Energy:** Sources that are finite and can be depleted.",
              "Examples: Fossil Fuels (oil, coal, gas), Nuclear Energy."
            ]
          },
          {
            "text": "**Environmental Impact:**",
            "subpoints": [
              "Burning fossil fuels releases carbon dioxide (\\( CO_2 \\)), a greenhouse gas that causes global warming, rising sea levels, and air pollution."
            ]
          }
        ]
      },
      {
        "id": "T-03",
        "title": "Kinetic and Potential Energy",
        "points": [
          {
            "text": "**Kinetic Energy (T or KE):** The energy an object possesses due to its motion.",
            "subpoints": [
              "**Formula:** \\( KE = \\frac{1}{2} m v^2 \\), where \\( m \\) is mass and \\( v \\) is velocity.",
              "**Work-Kinetic Energy Theorem:** The total work done on an object equals its change in kinetic energy: \\( W = \\frac{1}{2} m v^2 - \\frac{1}{2} m u^2 \\)."
            ]
          },
          {
            "text": "**Potential Energy (U or PE):** The energy stored in an object due to its position or state.",
            "subpoints": [
              "**Gravitational Potential Energy:** Energy due to height. \\( PE = m g h \\), where \\( h \\) is height.",
              "**Elastic Potential Energy:** Energy stored in a stretched or compressed spring. \\( PE = \\frac{1}{2} k x^2 \\), where \\( k \\) is the spring constant."
            ]
          },
          {
            "text": "**Mechanical Energy:** The sum of kinetic and potential energy.",
            "subpoints": []
          },
          {
            "text": "**Conservation of Mechanical Energy:** In an ideal system (no friction), the total mechanical energy remains constant. Potential energy converts into kinetic energy and vice versa.",
            "subpoints": []
          }
        ]
      },
      {
        "id": "T-04",
        "title": "Conservation and Transformation of Energy",
        "points": [
          {
            "text": "**Fundamental Law:** Energy cannot be created or destroyed; it can only be transformed from one form to another. The total energy in the universe is constant.",
            "subpoints": []
          },
          {
            "text": "**Common Energy Transformations:**",
            "subpoints": [
              "**Electric Fan:** Electrical Energy → Mechanical Energy.",
              "**Battery:** Chemical Energy → Electrical Energy.",
              "**Solar Panel:** Light Energy → Electrical Energy.",
              "**Nuclear Reactor:** Mass is transformed into a massive amount of Energy."
            ]
          },
          {
            "text": "**Mass-Energy Equivalence (Einstein''s Formula):** \\( E = m c^2 \\)",
            "subpoints": [
              "\\( E \\) is Energy",
              "\\( m \\) is Mass",
              "\\( c \\) is the speed of light (\\( 3 \\times 10^8 \\, \\text{m/s} \\))",
              "This principle is the basis for nuclear power and atomic bombs."
            ]
          }
        ]
      },
      {
        "id": "T-05",
        "title": "Power and Efficiency",
        "points": [
          {
            "text": "**Power:** The rate at which work is done or energy is transferred. It measures how *fast* work is done.",
            "subpoints": [
              "**Formula:** \\( P = \\frac{W}{t} \\)",
              "**Unit:** Watt (W). \\( 1 \\, \\text{W} = 1 \\, \\text{J/s} \\).",
              "**Another Useful Formula:** Power = Force × Velocity, or \\( P = F \\times v \\).",
              "**Kilowatt-hour (kWh):** A common unit for electrical energy. \\( 1 \\, \\text{kWh} = 3.6 \\times 10^6 \\, \\text{J} \\)."
            ]
          },
          {
            "text": "**Efficiency (\\( \\eta \\)):** A measure of how effectively a machine or process converts input energy into useful output energy.",
            "subpoints": [
              "**Formula:** \\( \\eta = \\frac{\\text{Useful Output Energy}}{\\text{Total Input Energy}} \\times 100\\% \\)",
              "**No Unit:** Efficiency is a percentage.",
              "**Example:** An incandescent bulb is inefficient because it converts only 10 J of light from 100 J of electrical energy, wasting 90 J as heat."
            ]
          }
        ]
      }
    ]
  }'::jsonb,
  'Physics',
  'High School'
);
