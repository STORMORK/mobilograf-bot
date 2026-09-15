export default async function handler(req, res) {

  if (req.method !== "GET") {

    return res.status(405).json({
      error:
        "Method not allowed"
    });

  }


  try {

    const supabaseUrl =
      process.env.SUPABASE_URL;

    const supabaseKey =
      process.env.SUPABASE_SECRET_KEY;


    if (
      !supabaseUrl ||
      !supabaseKey
    ) {

      return res.status(500).json({

        error:
          "Supabase environment variables are missing"

      });

    }


    const response =
      await fetch(
        `${supabaseUrl}/rest/v1/site_content?id=eq.1&select=*`,
        {
          method: "GET",

          headers: {

            apikey:
              supabaseKey,

            Authorization:
              `Bearer ${supabaseKey}`

          }
        }
      );


    const data =
      await response.json();


    if (!response.ok) {

      return res.status(500).json({

        error:
          "Supabase error",

        details:
          data

      });

    }


    return res.status(200).json(

      data[0] || {}

    );


  } catch (error) {

    console.error(error);


    return res.status(500).json({

      error:
        "Internal server error"

    });

  }

}